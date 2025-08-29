// server.js
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3002;

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'auth_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
};

const db = pgp(dbConfig);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Routes
app.post('/register', async (req, res) => {
    try {
        const { name, email, password, confirmPassword, position } = req.body;
        
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }
        
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
            return res.status(400).json({ 
                error: 'Password must be at least 8 characters with both uppercase and lowercase letters' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await db.one(
            'INSERT INTO users(name, email, password, position, is_admin) VALUES($1, $2, $3, $4, $5) RETURNING id',
            [name, email, hashedPassword, position, false]
        );
        
        res.status(201).json({ message: 'Registration successful. Awaiting admin approval.', userId: newUser.id });
    } catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Email already in use' });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        if (!user.is_approved) {
            return res.status(401).json({ error: 'Account not approved yet' });
        }
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const accessToken = jwt.sign(
            { userId: user.id, email: user.email, isAdmin: user.is_admin },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '1h' }
        );
        
        res.json({ accessToken, isAdmin: user.is_admin, name: user.name });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour
        
        await db.none(
            'INSERT INTO password_reset_tokens(user_id, token, expires_at) VALUES($1, $2, $3)',
            [user.id, token, expiresAt]
        );
        
        // In a real app, you would send an email with a reset link here
        res.json({ message: 'Password reset link sent to email', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process password reset' });
    }
});

app.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        const resetToken = await db.oneOrNone(
            'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used = false',
            [token]
        );
        
        if (!resetToken) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }
        
        if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters with both uppercase and lowercase letters'
            });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await db.tx(async t => {
            await t.none('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, resetToken.user_id]);
            await t.none('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);
        });
        
        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

// Admin routes
app.get('/admin/users', authenticateToken, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const users = await db.any('SELECT id, name, email, position, is_approved FROM users WHERE is_admin = false');
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.put('/admin/users/:id/approve', authenticateToken, async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const userId = req.params.id;
        
        await db.none('UPDATE users SET is_approved = true WHERE id = $1', [userId]);
        
        res.json({ message: 'User approved' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

app.post("/api/viewport/update", async (req, res) => {
  const { user_id, min_lat, max_lat, min_lon, max_lon } = req.body || {};
  if (!user_id || min_lat === undefined || max_lat === undefined || min_lon === undefined || max_lon === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    await db.none(
      `
      INSERT INTO user_viewport (user_id, min_lat, max_lat, min_lon, max_lon, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (user_id) DO UPDATE
      SET min_lat = EXCLUDED.min_lat,
          max_lat = EXCLUDED.max_lat,
          min_lon = EXCLUDED.min_lon,
          max_lon = EXCLUDED.max_lon,
          updated_at = now();
      `,
      [user_id, min_lat, max_lat, min_lon, max_lon]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
