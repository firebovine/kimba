# kimba.js - http://specops.network/

## What it does:
1. Grab the current, or next upcoming Holiday via HolidayAPI
1. Grab the first 9 image results from searx, for the holiday (+ "holiday colors")
1. Analyze their color palettes
1. Create gif of kimba's tongue with generated palettes

## Why it does it:
1. Because it can.

## How you can use it
1. ```npm install```
1. Place your HolidayAPI key into .apikey
1. Create an image mask for the portion of the image you want colorized, if you want a mask.
1. run it ```./kimba.js <source image> <destination image> [image mask]```
1. Example: ```./kimba.js kimbasauce.jpg kimba.gif kimbasauce_mask.png```
1. Use cron.

## Testing procedures
1. ship it
