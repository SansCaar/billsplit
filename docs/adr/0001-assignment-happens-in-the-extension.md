# Assignment happens in the extension, not the web app

The Chrome extension parses the Walmart Order *and* runs the first Assignment, then sends the finished Expense to the web app. We chose this so the person already on the Walmart page can finish in one place, and so the web app never has to understand Walmart's page structure. The web app still hosts the same assignment screen (shared component) for later fixes by other Members.
