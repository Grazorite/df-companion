# Python Environment Setup

## Overview

The project uses Python scripts for image scraping (pets and guests). To avoid conflicts with system Python packages, we use a **virtual environment** (`.venv/`) that is automatically managed.

## Automatic Setup

When you run any Python-dependent script for the first time, the virtual environment is automatically created and configured:

```bash
npm run images:pets    # Auto-creates venv if needed
npm run images:guests  # Auto-creates venv if needed
```

## Manual Setup

To manually setup the Python environment:

```bash
npm run setup:python
```

This will:
1. Create a virtual environment at `.venv/`
2. Install the `requests` library
3. Display instructions for manual activation

## What Gets Installed

- **Python 3** (using your system's `python3`)
- **requests** library (for HTTP requests to forum pages)

## Scripts Using Python

| Script | Command | Purpose |
|--------|---------|---------|
| `add_pet_images.py` | `npm run images:pets` | Add DF-Pedia GitHub image URLs to pets |
| `add_guest_images.py` | `npm run images:guests` | Extract guest character images from forum |

## Directory Structure

```
df-companion/
├── .venv/                 # Python virtual environment (gitignored)
│   ├── bin/
│   │   ├── activate       # Activation script
│   │   └── python3        # Isolated Python interpreter
│   └── lib/
│       └── python3.x/
│           └── site-packages/  # Installed packages (requests)
├── scripts/
│   ├── setup_venv.sh      # Setup script
│   ├── run_with_venv.sh   # Wrapper to run Python with venv
│   ├── add_pet_images.py
│   └── add_guest_images.py
└── package.json           # npm scripts reference the wrappers
```

## Manual Activation (Optional)

If you need to run Python scripts manually or debug:

```bash
# Activate the virtual environment
source .venv/bin/activate

# Your prompt will change to show (venv)
(venv) $ python3 scripts/add_guest_images.py

# Deactivate when done
deactivate
```

## Troubleshooting

### "python3: command not found"

Install Python 3 using Homebrew:
```bash
brew install python3
```

### "Virtual environment is corrupted"

Delete and recreate:
```bash
rm -rf .venv
npm run setup:python
```

### "Permission denied" when running scripts

Make sure shell scripts are executable:
```bash
chmod +x scripts/setup_venv.sh scripts/run_with_venv.sh
```

### Need to add more Python packages

Edit `scripts/setup_venv.sh` and add pip install lines:
```bash
pip install requests
pip install beautifulsoup4  # Example
```

Then recreate the venv:
```bash
rm -rf .venv
npm run setup:python
```

## CI/CD Considerations

If deploying to CI/CD:

1. **Vercel/Netlify**: Python scripts are only for local data curation, not needed in build
2. **GitHub Actions**: Add Python setup to workflow:
   ```yaml
   - name: Setup Python
     uses: actions/setup-python@v4
     with:
       python-version: '3.x'
   
   - name: Setup Python environment
     run: npm run setup:python
   ```

## Why Virtual Environment?

- ✅ **Isolation**: Packages don't conflict with system Python
- ✅ **Reproducibility**: Everyone uses the same package versions
- ✅ **Clean**: Easy to delete and recreate (just `rm -rf .venv`)
- ✅ **Gitignored**: Not checked into version control
- ✅ **Automatic**: No manual setup required for most users
