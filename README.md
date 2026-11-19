This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Schedule management

Administrators can queue classes by faculty member and duration, generate a weekly schedule with Google Gemini, and edit generated assignments. Generated times are validated on the server, and overlapping assignments for the same faculty member are rejected. Faculty members can view their schedules but cannot add, generate, or edit classes.

Manage allowed rooms and designate or change each room as Lecture or Lab from the admin Rooms page. Faculty Schedules shows a picker populated from that room inventory; schedule generation can use any listed room and rejects overlaps for either a faculty member or a room. Admin edits and approved faculty requests also check room availability; rooms in use cannot be removed.

Faculty can submit a preferred subject, day, and time from My Schedule. The form warns when the requested time overlaps one of their assigned classes, but still sends the request for administrator review. Administrators can approve or decline requests on the Faculty Schedules page; approval rechecks conflicts and adds the class to the faculty member’s schedule.

Set `Geminus_API_KEY` in the server environment to enable AI generation. `Geminus_API_NAME` can optionally specify a Gemini model identifier; otherwise the generator uses `gemini-2.5-flash`. The key is sent to Google only from the server and is never exposed to the browser.

## Password resets

Forgot-password links are sent through Resend. Configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a verified Resend sender), and `APP_URL` (the public application origin, using HTTPS in production) in the server environment. Reset tokens are single-use, stored hashed, expire after 30 minutes, and are limited to one email per account each minute. Changing a password revokes the account's existing sessions.

## Curriculum imports

Administrators can add a subject manually or upload a CSV, PDF, DOCX, TXT, or Markdown file from the Curriculum Subjects page. Manual entries require a subject name, category, and whole-number unit count from 1 to 100, and accept an optional code and department. Subjects are grouped by category and display their code and unit count. For imports, a `Category` column is used when present, otherwise the detected department is used as the category. Files must be 10 MB or smaller. CSV files work best with columns named `Subject Name` (or `Course Name`/`Title`), `Course Code` (optional), `Units` or `Credits` (optional), and `Category` or `Department` (optional). Text documents should list coded subjects such as `CS101 - Introduction to Computing`, or use a `Subjects` heading followed by a bulleted list. Imports add new subjects and update matching course codes; they do not remove catalog entries missing from the uploaded file. Image-only or scanned PDFs are not OCR-readable.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
