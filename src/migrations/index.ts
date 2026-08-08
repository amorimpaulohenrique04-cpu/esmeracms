import * as migration_20260801_000000_initial_schema from './20260801_000000_initial_schema'
import * as migration_20260801_214500_stage19_customer_privacy from './20260801_214500_stage19_customer_privacy'
import * as migration_20260802_205108_public_content_publication from './20260802_205108_public_content_publication'
import * as migration_20260802_213200_home_partial_overrides from './20260802_213200_home_partial_overrides'
import * as migration_20260804_015500_public_revision from './20260804_015500_public_revision'
import * as migration_20260807_104500_product_import_v2 from './20260807_104500_product_import_v2'
import * as migration_20260807_164500_cleanup_imported_product_media from './20260807_164500_cleanup_imported_product_media'
import * as migration_20260808_130000_product_card_model from './20260808_130000_product_card_model'

export const migrations = [
  {
    up: migration_20260801_000000_initial_schema.up,
    down: migration_20260801_000000_initial_schema.down,
    name: '20260801_000000_initial_schema',
  },
  {
    up: migration_20260801_214500_stage19_customer_privacy.up,
    down: migration_20260801_214500_stage19_customer_privacy.down,
    name: '20260801_214500_stage19_customer_privacy',
  },
  {
    up: migration_20260802_205108_public_content_publication.up,
    down: migration_20260802_205108_public_content_publication.down,
    name: '20260802_205108_public_content_publication',
  },
  {
    up: migration_20260802_213200_home_partial_overrides.up,
    down: migration_20260802_213200_home_partial_overrides.down,
    name: '20260802_213200_home_partial_overrides',
  },
  {
    up: migration_20260804_015500_public_revision.up,
    down: migration_20260804_015500_public_revision.down,
    name: '20260804_015500_public_revision',
  },
  {
    up: migration_20260807_104500_product_import_v2.up,
    down: migration_20260807_104500_product_import_v2.down,
    name: '20260807_104500_product_import_v2',
  },
  {
    up: migration_20260807_164500_cleanup_imported_product_media.up,
    down: migration_20260807_164500_cleanup_imported_product_media.down,
    name: '20260807_164500_cleanup_imported_product_media',
  },
  {
    up: migration_20260808_130000_product_card_model.up,
    down: migration_20260808_130000_product_card_model.down,
    name: '20260808_130000_product_card_model',
  },
]
