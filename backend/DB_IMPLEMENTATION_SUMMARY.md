# Database Implementation Summary

## Overview
Replaced the in-memory store with a SQLite database using SQLAlchemy, with support for easy migration to other databases (e.g., PostgreSQL) via environment variable configuration.

## Files Created/Modified

### New Files
1. **app/config.py** - Database configuration using `DATABASE_URL` environment variable
2. **app/db/database.py** - SQLAlchemy engine, session factory, and base class
3. **app/db/models.py** - SQLAlchemy ORM model for Party
4. **app/db/seed.py** - Database initialization and seeding functions

### Modified Files
1. **app/db/__init__.py** - Updated exports
2. **app/store/store.py** - Replaced in-memory store with database-backed Store class
3. **app/main.py** - Added database initialization on startup
4. **tests/conftest.py** - Updated to use SQLite in-memory database for tests
5. **tests/test_parties.py** - Updated test to work with database store
6. **README.md** - Documented DATABASE_URL environment variable

## Key Features

### Database Agnostic Design
- Uses `DATABASE_URL` environment variable for configuration
- Default: SQLite (`sqlite:///./waitlist.db`)
- Easy to switch to PostgreSQL: `postgresql://user:pass@localhost/dbname`
- All database operations use SQLAlchemy ORM, making the switch transparent

### SQLAlchemy Models
- `PartyModel` - ORM model matching the domain model
- Supports all fields: id, name, size, phone, timestamps, resolution
- Uses Enum for resolution field (seated, no-show)

### Store Class Changes
- Maintains the same public API as the in-memory store
- All CRUD operations now use database sessions
- Sessions are properly managed (created, committed, closed)
- Context manager support for session lifecycle

### Testing
- Tests use SQLite in-memory database (`sqlite:///:memory:`)
- Fresh database created for each test
- All 44 tests passing

## Usage

### Local Development (Default)
```bash
# Uses SQLite by default
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

### Production (PostgreSQL)
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/waitlist_db"
uvicorn app.main:app
```

### Environment Variables
| Variable       | Default                | Description                                      |
|----------------|------------------------|--------------------------------------------------|
| DATABASE_URL   | sqlite:///./waitlist.db | Database connection URL                         |
| JWT_SECRET     | dev-secret…           | Signing key for JWTs                            |
| TOKEN_EXPIRE_MIN | 60                  | Token lifetime in minutes                        |

## Database Schema

```sql
CREATE TABLE parties (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    size INTEGER NOT NULL,
    phone VARCHAR(50) NOT NULL,
    added_at BIGINT NOT NULL,
    notified_at BIGINT,
    expires_at BIGINT,
    resolved_at BIGINT,
    resolution VARCHAR(20) -- 'seated' or 'no-show'
);
```

## Migration to PostgreSQL

To switch to PostgreSQL (or any other SQLAlchemy-supported database):

1. Install the database driver:
   ```bash
   pip install psycopg2-binary  # For PostgreSQL
   ```

2. Set the environment variable:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/waitlist_db"
   ```

3. Run the application - SQLAlchemy will automatically create the tables on first run

No code changes required! The implementation is database-agnostic.
