# SynclerV2 Vendor

This repository contains a provider package for Syncler TV. The `GayPornScraper` provider scrapes several pornographic websites for playable video links.

## Files

- `GayPornScraper.json` – Provider manifest consumed by Syncler.
- `manifest.GayPornScraper.json` – Package manifest for distributing the provider.
- `scraper.js` – The search and resolve logic used by Syncler.

## Usage

Add the `permaUrl` from `GayPornScraper.json` to Syncler to load this package.

```
https://raw.githubusercontent.com/donatelloroberto/SynclerV2vendor/main/GayPornScraper.json
```

## Development

You can execute the scraper locally with Node.js (v18+ required) to test the `search` function:


Note: Node.js does not provide DOMParser by default. Install `jsdom` if running outside the Syncler environment.
```bash
node -e "const {search}=require('./scraper'); search('query','manporn').then(r=>console.log(r))"
```

Internet access may be required for full results.
