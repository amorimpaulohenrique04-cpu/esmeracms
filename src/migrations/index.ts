import * as migration_20260801_000000_initial_schema from './20260801_000000_initial_schema';
import * as migration_20260801_214500_stage19_customer_privacy from './20260801_214500_stage19_customer_privacy';

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
];
