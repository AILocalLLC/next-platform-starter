# Moving a number from GHL (LC Phone) to Twilio

First number: **(330) 919-6167**, New Gutters Near Me. Later: (330) 476-7348, AI Local, once that sub-account is built in the app.
GHL keeps the number working until the port completes. The app must be fully tested before the port date.

## Before you request the port
1. **Twilio upgraded** (pay-as-you-go, auto-recharge on). Ports are not available on trial accounts.
2. **Port-out details from GHL support.** Ask for, for 330-919-6167:
   - account number and port-out (transfer) PIN
   - the exact business name and service address on the account
   - a recent invoice or bill for the number, if they provide one (Twilio sometimes asks for it)
3. **Texting registration in Twilio (A2P 10DLC).** GHL's "A2P Verified" does not transfer. In Twilio: Messaging → Regulatory Compliance → A2P 10DLC.
   - Brand: legal business name, EIN, business address, website, contact person, email and phone.
   - Campaign: use case "Customer care" / "Mixed". Sample messages can use the app's real texts:
     - "Thanks Sam! Your New Gutters Near Me appointment is booked for Wednesday, October 14 at 9:00 AM. Reply STOP to opt out."
     - "Thanks! New Gutters Near Me got your request. A team member will reach out within a few hours to confirm. Reply STOP to opt out."
   - Opt-in description: "Customers call or text our business number and give their number to book an estimate."
   - Approval takes about 1–3 weeks. Start it right after upgrading.
4. **Toll-free verification for (877) 549-4401** (Messaging → Regulatory Compliance → Toll-free verification), so the test line can text customers too.

## Request the port (Twilio Console)
Phone Numbers → Manage → Port & Host → Port a number → enter 330-919-6167 → fill in the GHL details above → sign the authorization (LOA) Twilio generates → choose a date and time on a weekday morning (calls are quietest).

## Port day
1. When Twilio shows the number as active in your account, open the app: New Gutters Near Me → **Settings → AI phone number** → enter 330-919-6167 → **Connect**.
   This points the number's calls **and texts** at the app. (The 877 test line can stay connected to a second subaccount or be released.)
2. Call 330-919-6167 from a cell phone: Ari answers, books a test estimate, and the confirmation text arrives.
3. Text 330-919-6167: the text appears in **Messages** and is forwarded to the owner's phone.
4. In GHL, turn off the AI agent and workflows that used that number, so nothing double-sends.

## Rollback
If something is wrong on port day, put a forward on the number in Twilio (Phone Numbers → the number → "A call comes in" → Forward to the office cell). The port itself is not undone; the number stays in Twilio.
