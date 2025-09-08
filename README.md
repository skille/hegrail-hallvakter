# HallvaktOversikt

This project is designed to make it easy for hallvakter (hall attendants) in Hegra IL to check the availability of buildings and rooms. It scrapes booking data from bookup.no, saves the results as structured JSON, and publishes a static website to display booking availability.

## Features
- Hourly scraping of booking data from bookup.no using a PowerShell script
- Data definition in `data/resources.json`
- Bookings saved in `data/bookings/`
- Automated updates via GitHub Actions
- Static website for viewing availability and bookings

## Usage
1. Edit `data/resources.json` to define buildings and rooms.
2. The PowerShell script (`scripts/scrape.ps1`) fetches and structures booking data from bookup.no.
3. Bookings are saved as JSON files in `data/bookings/`.
4. GitHub Actions workflow (`.github/workflows/scrape.yml`) runs the script hourly and commits updates.
5. Static site files are in the `web/` folder.

## How it works
- The workflow runs every hour, scrapes the latest bookings from bookup.no, and pushes changes to the repository.
- The static site reads the JSON files to present booking availability and details for hallvakter in Hegra IL.

## Folder Structure
```
.
├── data/
│   ├── resources.json
│   └── bookings/
├── scripts/
│   └── scrape.ps1
├── web/
│   ├── index.html
│   ├── bookings.js
│   └── style.css
├── .github/
│   └── workflows/
│       └── scrape.yml
└── README.md
```

## License
MIT
