# HostelMate

HostelMate is a modern hostel expense management web app designed for students and roommates. It helps users track spending, split bills, manage settlements, and analyze monthly expenses without needing a backend or account system.

## Features

- Track personal and shared hostel expenses
- Add categories and notes for each expense
- Split bills among roommates automatically
- View who owes whom and pending settlements
- Set a monthly spending limit and track personal share against the budget
- Manage roommate profiles
- Edit expenses, export monthly reports, and review settlement history
- See data-driven spending analytics and monthly history
- Save all data in browser LocalStorage
- Toggle light and dark mode
- Works on desktop, tablet and mobile

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- LocalStorage
- Chart.js
- Font Awesome
- Google Fonts

## Screenshots

Add screenshots here after deployment or while running locally.

- Dashboard screenshot
- Expenses page screenshot
- Analytics screenshot
- Mobile view screenshot

## Installation

1. Download or clone this project.
2. Open the project folder in your browser, or run a local static server from the project directory.
3. To serve locally, use:

```bash
cd "c:/Users/bhuwa/hostel budget"
python -m http.server 8000
```

4. Open http://localhost:8000 in your browser.

## GitHub Pages Deployment

1. Push the project to a GitHub repository.
2. In GitHub, open the repository and go to Settings > Pages.
3. Select the main branch as the source.
4. Set the folder to `/root` or the folder that contains the website files.
5. Save the settings and wait for GitHub to publish the site.
6. Your site will be available at:

```text
https://yourusername.github.io/HostelMate/
```

7. Replace the placeholder GitHub username and repository name as needed for your GitHub Pages deployment.

## Google Search Console

1. Create a Google Search Console property for the deployed URL.
2. Verify ownership using the recommended method.
3. Submit the sitemap file, for example:

```text
https://yourusername.github.io/HostelMate/sitemap.xml
```

4. Request indexing for the homepage and any relevant pages.
5. Use a search query like:

```text
site:yourusername.github.io/HostelMate
```

## Folder Structure

```text
HostelMate/
├── assets/
│   └── favicon.svg
├── index.html
├── styles.css
├── app.js
├── robots.txt
├── sitemap.xml
├── README.md
└── .gitignore
```

## Future Improvements

- User authentication and profile management
- Cloud database sync with Firebase or MongoDB
- Real-time roommate collaboration
- Online payment tracking or settlement reminders
- Notifications and reminders
- PWA/mobile app version

Bhuwan Goyal

CSE Student

## Privacy Note

This app stores data in the browser using LocalStorage. It does not send sensitive personal information to any backend server or store API keys. Use it only for local, browser-based personal budgeting.
