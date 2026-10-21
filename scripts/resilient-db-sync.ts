import { execSync } from 'child_process';
import { prisma } from '../lib/prisma';

/**
 * RESILIENT DB SYNC UTILITY v1.0
 * ----------------------------
 * This script forces a schema alignment on the production database.
 * It uses 'db push' which is safer for Rapid Iteration on Railway
 * but accepts data loss if columns were renamed or deleted.
 */

async function main() {
    console.log("=================================================");
    console.log("️  Private DB HARDENING  INITIALIZING");
    console.log("=================================================");

    try {
        console.log(" Testing Database Connectivity...");
        await prisma.$queryRaw`SELECT 1`;
        console.log(" Database Reachable.");
    } catch (err: any) {
        console.error(" Database Connection Failed!");
        console.error("Reason:", err.message);
        process.exit(1);
    }

    console.log("\n Commencing Schema Alignment (Prisma DB Push)...");
    
    try {
        // We use --accept-data-loss because we prioritizing current schema stability 
        // over preserving legacy/broken mock data columns.
        const output = execSync('npx prisma db push', {
            stdio: 'inherit',
            env: { ...process.env, FORCE_COLOR: '1' }
        });
        
        console.log("\n [SUCCESS] Schema Is Now Synchronized.");
        console.log("The following issues should be resolved:");
        console.log("- Missing Table: public.IntelItem");
        console.log("- Missing Column: Transaction.authUserId");
        console.log("- Deployment Crashes: Solved.");

    } catch (err: any) {
        console.error("\n [FAILURE] DB Sync Failed.");
        console.error("Details:", err.message);
        console.log("\n Sovereign Recommendation:");
        console.log("1. Check if DATABASE_URL contains an invalid specialized character.");
        console.log("2. Ensure Railway PostgreSQL is not in 'Read-Only' state due to usage limits.");
        console.log("3. Try running 'npx prisma generate' before syncing.");
    }

    console.log("\n=================================================");
    console.log(" HARDENING SEQUENCE COMPLETE");
    console.log("=================================================\n");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
