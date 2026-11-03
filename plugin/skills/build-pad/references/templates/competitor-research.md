# Template: Competitor Research

Use this template for any pad that compares a business with its competitors: a competitor research run, a "how do I stack up" check, a weekly competitor watch.
Start from [competitor-research.html](competitor-research.html): copy it into the pad folder as `index.html`, fill every `{{...}}`, repeat the blocks marked `REPEAT`, and delete the instruction comments.
The reviewer's top bar labels the pad "Competitor Research template" because of its `<meta name="buildpad-template" content="competitor-research">`. Keep that tag in every version.

## What stays fixed

- The tabs: **Summary**, one tab per competitor (in the order the user gave them), then **Your site** when the user's own site was read. Never add other tabs.
- The Summary, in this order: the takeaway (one or two lines, about the user's business, not the competitors), "Since <date>" on repeat runs only, **What to change**, **Side by side**.
- **What to change:** at most 5, ranked by impact. Each has one line on what to do, a `This week` or `Bigger project` pill, one line on why it fits this business, and a link to the competitor tab it came from. Keep the Start / Skip choice and the queue button as written.
- **Side by side:** the four columns Price, Promise, Next step, Proof, with the user on top. Write `None shown` or `None found` in a `<td class="no">` rather than leaving a cell empty.
- Every competitor tab, in this order: the exact screenshot with numbered pins, **What we found** (one item per pin, same numbers), **How they get customers** (numbered pages with their paths), **For your business** (copy this, or don't, and why), **Couldn't see**, and the URLs read.
- The ids in the skeleton (`v-<slug>`, `chg-<n>`, `<slug>-found`, `<slug>-path`, `<slug>-take`). Reviewers comment on these and change lists target them.

A `<slug>` is the competitor's domain without the dot and suffix, lowercase, for example `ledgerly` for `ledgerly.com`.

## Screenshots

Use the real screenshot of each home page, never a drawing of one.

1. Save each screenshot into the pad folder as `shots/<slug>.jpg`, and publish the folder (not just the HTML file).
2. Shrink each one before publishing, since a version can be at most 2 MB: 1000 pixels wide and cropped to the first 1600 pixels of height. On macOS, `sips --resampleWidth 1000 -s format jpeg -s formatOptions 70 in.png --out shots/<slug>.jpg`. Elsewhere, ImageMagick: `convert in.png -resize 1000x -crop 1000x1600+0+0 -quality 70 shots/<slug>.jpg`. Each file should end up under 250 KB.
3. Look at each screenshot before you place pins. Put each pin at the left edge of the thing it points to (the headline, the price, the button), as `left` and `top` percentages of the image. At most 5 pins a screenshot.

## What the user can still change

The template is where the page starts, not a limit. When the user asks for a change ("cut the side-by-side", "add a column for guarantees"), make it, keep the brand and the tabs, and keep the template tag. When they want the change every time, update their own competitor research skill so its next run asks for it.
