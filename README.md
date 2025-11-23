Thx for applying to our startup. We are looking to hire an engineer asap so let's get things in motion. We've received lots of applicants all with unique experiences and I would love to interview you all and get to know you on a personal level, but it's sadly not feasible. We decided we'll only interview candidates that pass our custom take home challenge. I know take home challenges tend to be annoying and not worth the time but this one is different. I've spent lots of time and care building the challenge from scratch and making it fun and interesting. It's not a typical leetcode/algorithm/logic assessment; those have solutions that are easily accessible, and do a horrible job at measuring your ability to solve real problems.

Anyone who passes the challenge immediately gets an interview with our CTO and thus has an extremely high likelihood of being hired.

Here is the take home challenge:
Figure out how to programmatically send disappearing photos on Telegram web using a chrome extension.

What we measure with this take home challenge:
This is not really a frontend/chrome extension challenge. This challenge is designed to only measure your resourcefulness as an engineer and ability to quickly learn new things. Being an expert on chrome extensions, javascript, or reverse engineering won't help at all. This is the kind of challenge where relying on experience won't help much; instead you’ll have to learn new things and be highly resourceful.

More details:
Telegram web allows you to send photos, but there is no way to send disappearing photos through the UI. You'll have to dig deeper.

Rules:
There are only two rules.

1. Your solution must be fully contained in a chrome extension. This means no other code (ie. localhost server) outside of the extension is allowed.
2. You must be on web.telegram.org/a which is version A of Telegram web, not web.telegram.org/k which is version K or others.

Video guide:
Please watch the video I made describing the challenge and showcasing the solution. https://vimeo.com/1138813223

Here is the job posting in case you lost it:
https://www.linkedin.com/jobs/view/4340027284

Here is the code for the challenge:
You are given a simple boilerplate chrome extension, feel free to change any file or add new files as needed. https://drive.google.com/drive/folders/19KVkKL8j6dtwp35-rxe\_lEAusma2ZUp4

Submission:
Please reply to this only with a Google Drive link to your chrome extension code.

Deadline:
Please try to finish by the end of day next Friday (November 28), speed is one of the things we are measuring here too.

If you have questions please figure them out on your own as that is part of the challenge. Good luck, and I hope to hear from you soon :)

\## UI Toggle for TTL



Clicking the extension icon opens a small popup with:



\- A checkbox \*\*“Enable disappearing photos”\*\*

\- A numeric field \*\*“TTL (seconds)”\*\*



When you click \*\*Save\*\*:



1\. The values are stored in `chrome.storage.sync`.

2\. The active `web.telegram.org/a` tab is notified.

3\. The injected hook updates its in-memory config and uses the new TTL for subsequent media sends.



No page reload is required; changes apply to the next outgoing photo that Telegram Web A sends.



