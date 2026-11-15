"""Rendert web/og.png (1200×630) uit og.html. Gebruik: python3 tools/og.py (vanuit mv3/)."""
import asyncio, os
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1200, "height": 630})
        await pg.goto("file://" + os.path.join(D, "og.html")); await pg.wait_for_timeout(600)
        await pg.screenshot(path=os.path.join(D, "..", "web", "og.png")); await b.close()
asyncio.run(main())
