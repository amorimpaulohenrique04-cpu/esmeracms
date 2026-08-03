import * as migration_20260801_000000_initial_schema from './20260801_000000_initial_schema'
import * as migration_20260801_214500_stage19_customer_privacy from './20260801_214500_stage19_customer_privacy'
import * as migration_20260802_205108_public_content_publication from './20260802_205108_public_content_publication'
import * as migration_20260802_213200_home_partial_overrides from './20260802_213200_home_partial_overrides'

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
]
