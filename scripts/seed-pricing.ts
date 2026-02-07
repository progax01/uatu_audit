/**
 * Seed Neurons Token Pricing Configuration
 * Run with: npx tsx scripts/seed-pricing.ts
 */

import 'dotenv/config';
import { db } from '../src/db/index.js';
import { tokenPricingConfig } from '../src/db/schema.js';

async function seedPricingConfig() {
  console.log('Seeding Neurons token pricing configuration...');

  const configs = [
    {
      configKey: 'neurons_per_sloc_multiplier',
      configValue: BigInt(1),
      description: 'Multiplier for neurons per SLOC (divide by 1000 for actual rate of 0.001)',
    },
    {
      configKey: 'neurons_per_sloc_divisor',
      configValue: BigInt(1000),
      description: 'Divisor for neurons per SLOC calculation',
    },
    {
      configKey: 'neurons_per_1k_ai_tokens',
      configValue: BigInt(10),
      description: 'Neurons charged per 1000 AI tokens consumed',
    },
    {
      configKey: 'reservation_buffer_percent',
      configValue: BigInt(150),
      description: 'Buffer percentage for reservations (150 = 1.5x estimated cost)',
    },
    {
      configKey: 'grace_period_audits',
      configValue: BigInt(1),
      description: 'Number of audits allowed to go into debt before blocking',
    },
  ];

  for (const config of configs) {
    try {
      await db.insert(tokenPricingConfig).values(config).onConflictDoNothing();
      console.log(`✓ Inserted config: ${config.configKey}`);
    } catch (error: any) {
      console.error(`Failed to insert ${config.configKey}`, { error: error.message });
    }
  }

  console.log('Pricing configuration seeded successfully!');
  process.exit(0);
}

seedPricingConfig().catch((error) => {
  console.error('Failed to seed pricing config', { error });
  process.exit(1);
});
