import { sql } from '@payloadcms/db-postgres/drizzle'
import type { Payload } from 'payload'

import { numberFromRow, runReportingQuery, stringFromRow } from './db'
import { closedOpportunityWhere, createdOpportunityWhere, salesWhere } from './filters'
import { safeRatio, type NormalizedReportingFilters } from './metrics'

export type ProductPerformanceRow = {
  productId: number
  title: string
  opportunitiesCreated: number
  wonOpportunities: number
  lostOpportunities: number
  conversionRate: number | null
  validSales: number
  units: number
  grossItemRevenueCents: number
}

export type CategoryPerformanceRow = {
  categoryId: number
  title: string
  opportunitiesCreated: number
  wonOpportunities: number
  lostOpportunities: number
  conversionRate: number | null
  validSales: number
  units: number
  grossItemRevenueCents: number
}

export async function getProductPerformance(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<ProductPerformanceRow[]> {
  const createdWhere = createdOpportunityWhere(filters)
  const closedWhere = closedOpportunityWhere(filters)
  const validSaleWhere = salesWhere(filters)
  const createdProductFilter = filters.productId === null ? sql`` : sql`AND created_interest.products_id = ${filters.productId}`
  const closedProductFilter = filters.productId === null ? sql`` : sql`AND closed_interest.products_id = ${filters.productId}`
  const saleProductFilter = filters.productId === null ? sql`` : sql`AND sale_item.product_id = ${filters.productId}`

  const rows = await runReportingQuery(payload, 'products.performance', sql`
    WITH created_product AS (
      SELECT
        created_interest.products_id AS product_id,
        COUNT(DISTINCT o.id)::integer AS opportunities_created
      FROM opportunities_rels created_interest
      INNER JOIN opportunities o ON o.id = created_interest.parent_id
      WHERE ${createdWhere}
        AND created_interest.path = 'interestedProducts'
        AND created_interest.products_id IS NOT NULL
        ${createdProductFilter}
      GROUP BY created_interest.products_id
    ),
    closed_product AS (
      SELECT
        closed_interest.products_id AS product_id,
        (COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'won'))::integer AS won_opportunities,
        (COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'lost'))::integer AS lost_opportunities
      FROM opportunities_rels closed_interest
      INNER JOIN opportunities o ON o.id = closed_interest.parent_id
      WHERE ${closedWhere}
        AND closed_interest.path = 'interestedProducts'
        AND closed_interest.products_id IS NOT NULL
        ${closedProductFilter}
      GROUP BY closed_interest.products_id
    ),
    sale_product AS (
      SELECT
        sale_item.product_id,
        COUNT(DISTINCT s.id)::integer AS valid_sales,
        COALESCE(SUM(sale_item.quantity), 0)::integer AS units,
        COALESCE(SUM(sale_item.unit_price_cents * sale_item.quantity), 0)::bigint AS gross_item_revenue_cents
      FROM sales_items sale_item
      INNER JOIN sales s ON s.id = sale_item._parent_id
      WHERE ${validSaleWhere}
        AND sale_item.product_id IS NOT NULL
        ${saleProductFilter}
      GROUP BY sale_item.product_id
    ),
    product_keys AS (
      SELECT product_id FROM created_product
      UNION
      SELECT product_id FROM closed_product
      UNION
      SELECT product_id FROM sale_product
    )
    SELECT
      product_keys.product_id,
      product.title,
      COALESCE(created_product.opportunities_created, 0)::integer AS opportunities_created,
      COALESCE(closed_product.won_opportunities, 0)::integer AS won_opportunities,
      COALESCE(closed_product.lost_opportunities, 0)::integer AS lost_opportunities,
      COALESCE(sale_product.valid_sales, 0)::integer AS valid_sales,
      COALESCE(sale_product.units, 0)::integer AS units,
      COALESCE(sale_product.gross_item_revenue_cents, 0)::bigint AS gross_item_revenue_cents
    FROM product_keys
    INNER JOIN products product
      ON product.id = product_keys.product_id
     AND product.deleted_at IS NULL
    LEFT JOIN created_product USING (product_id)
    LEFT JOIN closed_product USING (product_id)
    LEFT JOIN sale_product USING (product_id)
    ORDER BY gross_item_revenue_cents DESC, valid_sales DESC, product.title ASC
  `)

  return rows.map((row) => {
    const won = numberFromRow(row.won_opportunities)
    const lost = numberFromRow(row.lost_opportunities)
    return {
      productId: numberFromRow(row.product_id),
      title: stringFromRow(row.title, 'Produto sem título'),
      opportunitiesCreated: numberFromRow(row.opportunities_created),
      wonOpportunities: won,
      lostOpportunities: lost,
      conversionRate: safeRatio(won, won + lost),
      validSales: numberFromRow(row.valid_sales),
      units: numberFromRow(row.units),
      grossItemRevenueCents: numberFromRow(row.gross_item_revenue_cents),
    }
  })
}

export async function getCategoryPerformance(
  payload: Payload,
  filters: NormalizedReportingFilters,
): Promise<CategoryPerformanceRow[]> {
  const createdWhere = createdOpportunityWhere(filters)
  const closedWhere = closedOpportunityWhere(filters)
  const validSaleWhere = salesWhere(filters)
  const categoryClause = filters.categoryId === null ? sql`` : sql`AND category_relation.categories_id = ${filters.categoryId}`
  const closedCategoryClause = filters.categoryId === null ? sql`` : sql`AND closed_category_relation.categories_id = ${filters.categoryId}`
  const saleCategoryClause = filters.categoryId === null ? sql`` : sql`AND sale_category_relation.categories_id = ${filters.categoryId}`
  const createdProductClause = filters.productId === null ? sql`` : sql`AND created_interest.products_id = ${filters.productId}`
  const closedProductClause = filters.productId === null ? sql`` : sql`AND closed_interest.products_id = ${filters.productId}`
  const saleProductClause = filters.productId === null ? sql`` : sql`AND sale_item.product_id = ${filters.productId}`

  const rows = await runReportingQuery(payload, 'categories.performance', sql`
    WITH created_category AS (
      SELECT
        category_relation.categories_id AS category_id,
        COUNT(DISTINCT o.id)::integer AS opportunities_created
      FROM opportunities_rels created_interest
      INNER JOIN opportunities o ON o.id = created_interest.parent_id
      INNER JOIN products_rels category_relation
        ON category_relation.parent_id = created_interest.products_id
       AND category_relation.path = 'categories'
      WHERE ${createdWhere}
        AND created_interest.path = 'interestedProducts'
        AND category_relation.categories_id IS NOT NULL
        ${categoryClause}
        ${createdProductClause}
      GROUP BY category_relation.categories_id
    ),
    closed_category AS (
      SELECT
        closed_category_relation.categories_id AS category_id,
        (COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'won'))::integer AS won_opportunities,
        (COUNT(DISTINCT o.id) FILTER (WHERE o.stage = 'lost'))::integer AS lost_opportunities
      FROM opportunities_rels closed_interest
      INNER JOIN opportunities o ON o.id = closed_interest.parent_id
      INNER JOIN products_rels closed_category_relation
        ON closed_category_relation.parent_id = closed_interest.products_id
       AND closed_category_relation.path = 'categories'
      WHERE ${closedWhere}
        AND closed_interest.path = 'interestedProducts'
        AND closed_category_relation.categories_id IS NOT NULL
        ${closedCategoryClause}
        ${closedProductClause}
      GROUP BY closed_category_relation.categories_id
    ),
    sale_category AS (
      SELECT
        sale_category_relation.categories_id AS category_id,
        COUNT(DISTINCT s.id)::integer AS valid_sales,
        COALESCE(SUM(sale_item.quantity), 0)::integer AS units,
        COALESCE(SUM(sale_item.unit_price_cents * sale_item.quantity), 0)::bigint AS gross_item_revenue_cents
      FROM sales_items sale_item
      INNER JOIN sales s ON s.id = sale_item._parent_id
      INNER JOIN products_rels sale_category_relation
        ON sale_category_relation.parent_id = sale_item.product_id
       AND sale_category_relation.path = 'categories'
      WHERE ${validSaleWhere}
        AND sale_category_relation.categories_id IS NOT NULL
        ${saleCategoryClause}
        ${saleProductClause}
      GROUP BY sale_category_relation.categories_id
    ),
    category_keys AS (
      SELECT category_id FROM created_category
      UNION
      SELECT category_id FROM closed_category
      UNION
      SELECT category_id FROM sale_category
    )
    SELECT
      category_keys.category_id,
      category.title,
      COALESCE(created_category.opportunities_created, 0)::integer AS opportunities_created,
      COALESCE(closed_category.won_opportunities, 0)::integer AS won_opportunities,
      COALESCE(closed_category.lost_opportunities, 0)::integer AS lost_opportunities,
      COALESCE(sale_category.valid_sales, 0)::integer AS valid_sales,
      COALESCE(sale_category.units, 0)::integer AS units,
      COALESCE(sale_category.gross_item_revenue_cents, 0)::bigint AS gross_item_revenue_cents
    FROM category_keys
    INNER JOIN categories category
      ON category.id = category_keys.category_id
     AND category.deleted_at IS NULL
    LEFT JOIN created_category USING (category_id)
    LEFT JOIN closed_category USING (category_id)
    LEFT JOIN sale_category USING (category_id)
    ORDER BY gross_item_revenue_cents DESC, valid_sales DESC, category.title ASC
  `)

  return rows.map((row) => {
    const won = numberFromRow(row.won_opportunities)
    const lost = numberFromRow(row.lost_opportunities)
    return {
      categoryId: numberFromRow(row.category_id),
      title: stringFromRow(row.title, 'Categoria sem título'),
      opportunitiesCreated: numberFromRow(row.opportunities_created),
      wonOpportunities: won,
      lostOpportunities: lost,
      conversionRate: safeRatio(won, won + lost),
      validSales: numberFromRow(row.valid_sales),
      units: numberFromRow(row.units),
      grossItemRevenueCents: numberFromRow(row.gross_item_revenue_cents),
    }
  })
}
