# KB Shop POS

React/Vite POS application for Hostinger Node.js hosting and MySQL. Authentication and POS data are handled by the Express/MySQL application; the runtime does not use Firebase.

## Hostinger deployment

Use a Hostinger Business/Cloud Node.js web app or a VPS (Node.js 22 recommended). PHP-only hosting cannot run this Express API.

1. Use the existing Hostinger database `u857660968_anz_website`. In phpMyAdmin, select it and import [`database/schema.sql`](database/schema.sql). This adds only `kb_*` tables and leaves the existing ERP tables intact.
2. Deploy this repository as a Node.js web app with Node.js 22. If Hostinger's Express preset does not show a build command, select **Other** so you can set Build command to `npm run build`, Output directory to `dist`, and Entry file to `server.js`. The server serves the frontend from `dist` or Hostinger's published `public_html` directory. Keep the project root as `./`.
3. Set `DB_HOST`, `DB_PORT`, `DB_NAME=u857660968_anz_website`, `DB_USER`, and `DB_PASS` in Hostinger environment variables, using the database's current values.
4. Set `SESSION_SECRET` to a long random secret, `SUPER_ADMIN_EMAIL` to the admin login email, and `SUPER_ADMIN_PASSWORD` to a strong password. The app creates or refreshes this super-admin account at startup. Keep these values private. `ERP_JWT_SECRET`, `ERP_ADMIN_USER`, and `ERP_ADMIN_PASSWORD` are accepted as fallback names.
5. Open `/api/health` and confirm it returns `{"ok":true}`. Sign in with the super-admin credentials and approve signup requests from the Super Admin panel.

For local development, install Node.js 22, import the schema into a local MySQL database, copy `.env.example` to `.env`, set the credentials and admin values, then run `npm install`, `npm run build`, and `npm start`.

## Signup approval and demo access

Signup asks for contact name, email, mobile, business name/type, address, district, and a confirmed password. Requests are stored as pending; they cannot sign in until the super admin approves them. Passwords are stored as bcrypt hashes. The super-admin login is provisioned from environment variables; no external auth account or console setup is involved.

Demo login: `demo@kbshop.example` / `Demo@12345`. Run the frontend with `npm run dev` and open the Vite URL to use a browser-local sample workspace without Hostinger environment variables, an API server, or MySQL. Demo changes stay in that browser's local storage. This demo credential is only for preview; it is not a server account.

Field SRs can sign in from the **SR Mobile Login** tab using their registered mobile number. The number must match exactly one active SR across the database. The server gives the session access only to SR Orders, customer due for that SR's assigned route, and retailer accounts on that route. Product costs, supplier records, and owner-only modules stay unavailable to SR sessions. Phone-only login does not verify possession of the phone; add SMS OTP before using this method for sensitive commercial deployments.

Existing Firebase accounts and Firestore data are not imported. Users must submit a new signup request and wait for super-admin approval.
