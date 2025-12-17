import "dotenv/config";
import express from "express";
import path from "path";
import helmet from "helmet";
import morgan from "morgan";
import Stripe from "stripe";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20"
});

const app = express();

// Security headers (CSP no inline JS, no third-party)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"],
        "img-src": ["'self'", "data:"],
        "style-src": ["'self'"],
        "script-src": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": []
      }
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);

app.use(morgan("tiny"));

// Rate limit (anti abuso)
const limiter = new RateLimiterMemory({ points: 90, duration: 60 }); // 90 req/min por IP
app.use(async (req, res, next) => {
  try {
    await limiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ error: "Too many requests. Try again later." });
  }
});

// Stripe webhook needs raw body
app.post("/webhook/stripe", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  const wh = process.env.STRIPE_WEBHOOK_SECRET;

  if (!wh) return res.status(500).send("Webhook secret missing.");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, wh);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("Payment completed:", session.id, session.customer_details?.email);
  }

  res.json({ received: true });
});

app.use(express.json({ limit: "120kb" }));

// Deposits (escala fácil). Los rangos se muestran en web; Stripe cobra depósito para iniciar.
const DEPOSITS = {
  starter_deposit: {
    name: "Starter — Project Deposit",
    description: "Deposit to start: landing/one-page web or small scope kickoff.",
    amount: 15000 // $150.00
  },
  pro_deposit: {
    name: "Pro — Project Deposit",
    description: "Deposit to start: multi-page or stronger scope kickoff.",
    amount: 30000 // $300.00
  },
  studio_deposit: {
    name: "Studio — Project Deposit",
    description: "Deposit to start: higher scope / priority scheduling.",
    amount: 50000 // $500.00
  }
};

function safeText(v, max = 200) {
  return String(v || "").trim().slice(0, max);
}

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const planId = safeText(req.body?.planId, 40);
    const email = safeText(req.body?.email, 120);

    if (!DEPOSITS[planId]) return res.status(400).json({ error: "Invalid plan." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email." });
    }

    const plan = DEPOSITS[planId];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${BASE_URL}/?paid=1`,
      cancel_url: `${BASE_URL}/?canceled=1`,
      customer_email: email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.amount,
            product_data: {
              name: plan.name,
              description: plan.description
            }
          }
        }
      ],
      metadata: { planId }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to create checkout session." });
  }
});

app.post("/api/contact", async (req, res) => {
  const name = safeText(req.body?.name, 80);
  const email = safeText(req.body?.email, 120);
  const message = safeText(req.body?.message, 2000);
  const budget = safeText(req.body?.budget, 60);
  const service = safeText(req.body?.service, 60);
  const hp = safeText(req.body?.company, 80); // honeypot

  if (hp) return res.json({ ok: true }); // bot
  if (name.length < 2 || message.length < 10) {
    return res.status(400).json({ error: "Please provide a valid name and message." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email." });
  }

  // Escalable: aquí conectas DB o email provider (Resend/SendGrid/Mailgun) más adelante.
  console.log("NEW LEAD:", { name, email, service, budget, messageLength: message.length });

  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.listen(PORT, () => {
  console.log(`DiegoUSA running on ${BASE_URL}`);
});
