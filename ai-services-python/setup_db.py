import asyncio
import asyncpg
import os

DATABASE_URL = "postgresql://postgres.nsyshhycairpwzbendgb:Ramling%407143%2A@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS public.sme_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    business_name TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id UUID,
    address TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    branch_address TEXT,
    ifsc_code TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: add more tables if needed, but these two are essential for auth/registration

-- Forcefully drop the NOT NULL constraint on role_id if it exists, 
-- because our backend bypasses the roles table to prevent crashes.
ALTER TABLE public.sme_users ALTER COLUMN role_id DROP NOT NULL;
ALTER TABLE public.bank_admin_users ALTER COLUMN role_id DROP NOT NULL;
"""

async def run_setup():
    print("Connecting to database...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("Connected successfully!")
        
        print("Executing schema setup...")
        await conn.execute(SCHEMA_SQL)
        print("Tables created successfully!")
        
        await conn.close()
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    asyncio.run(run_setup())
