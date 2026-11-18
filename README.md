<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4216d74f-44c8-415b-8aba-bd6a85c6789a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Render

The repository includes a Render Blueprint in [render.yaml](./render.yaml). To get a public URL:

1. Push the repository, including `render.yaml`, to GitHub.
2. In Render, choose **New → Blueprint** and connect this repository.
3. Enter your Gemini API key when Render requests `GEMINI_API_KEY`. Do not commit the key.
4. Apply the Blueprint and wait for the service to finish deploying.
5. Share the public URL shown on the Render service page (typically `https://<service-name>.onrender.com`).

The Blueprint uses a persistent disk for the SQLite database and uploaded images. Render requires a paid web-service plan to attach persistent disks; without one, user and presentation data would not survive service replacement.
