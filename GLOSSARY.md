# Bill Split

A shared-expense tracker for households, with first-class support for itemized Walmart orders so each person pays for exactly what they used.

## People

**Group**:
A set of Members who share Expenses and Balances, such as a household.
_Avoid_: Team, tricount, household (as a type name)

**Member**:
A person belonging to a Group. One person may be a Member of many Groups.
_Avoid_: User (when meaning group participation), participant

**Invite Link**:
A shareable link that lets a person join a Group. Any Member may share it; only the Group's creator can turn it off.
_Avoid_: Join code

## Spending

**Expense**:
A single spend recorded in a Group, with one Payer and a split among Members.
_Avoid_: Bill, transaction, entry

**Payer**:
The Member who paid for an Expense.
_Avoid_: Owner, buyer

**Settlement**:
A record that one Member paid another back outside the app, reducing what they owe.
_Avoid_: Payment, reimbursement

**Unassigned Remainder**:
The leftover cent or two when an amount does not divide evenly; it is shown on the Expense but added to no Member's share.
_Avoid_: Rounding error, penny

**Balance**:
How much a Member is owed (positive) or owes (negative) within a Group.

**Activity**:
A recorded change to anything in a Group (an Expense, a Settlement, a Member or the Group itself): who changed what, when, from what to what, and which Members it concerns.
_Avoid_: History, log entry, event

**Involved Member**:
A Member an Activity concerns: for an Expense, its Payer and everyone with a share before or after the change; for a Settlement, the two Members in it; for a change to the Group or its Members, everyone in the Group.
_Avoid_: Affected member, participant

## Notifications

**Notification**:
A message sent to a person's devices about an Activity or a Nudge; tapping it opens the place in the app it is about.
_Avoid_: Alert, push (that is the delivery, not the thing)

**Notification Level**:
How much Activity a person is notified about: All Activity, or only Activity they are Involved in. Each person has a default, and may set a different level for any Group.
_Avoid_: Notification setting, subscription

**Nudge**:
A playful Notification asking a Member to make a payment that Settle up shows they owe the sender, for that amount. It is not an Activity.
_Avoid_: Reminder, poke, request

## Walmart orders

**Order**:
A Walmart purchase, identified by its Walmart order number, that becomes one Expense when processed.
_Avoid_: Cart, receipt

**Item**:
One product line within an Order, with its quantity and price. "Product" is an accepted synonym in conversation and UI copy.
_Avoid_: Card (that is a UI shape, not a domain thing), line

**Fulfillment**:
A part of an Order that arrives separately (e.g. shipped vs. delivered from store), with its own Items and possibly its own Fees.
_Avoid_: Shipment, package

**Fee**:
Any non-Item, non-tax charge on an Order — delivery fee, shipping fee, driver tip, bag fee. A Fee belongs either to one Fulfillment or to the whole Order.
_Avoid_: Order-level charge, surcharge

**Assignment**:
The decision of which Members share an Item and how it is split between them.
_Avoid_: Allocation, claim

**Split Method**:
How an Item or Expense is divided among its Members: Equal, By Parts, or By Amount.
_Avoid_: Split type, mode

**Processing**:
Reading an Order from Walmart, Assigning its Items, and sending the result to the Group as an Expense.
_Avoid_: Importing, syncing
