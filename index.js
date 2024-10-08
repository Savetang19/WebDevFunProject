// load express project into variable
const express = require('express')
// load sqlite3 into variable
const sqlite3 = require('sqlite3')
// load handlebars into variable
const { engine } = require('express-handlebars')
// load bcrypt into variable
const bcrypt = require('bcrypt')
// load session into variable
const session = require('express-session')
// load connect-sqlite3 into variable
const connectSQLite3 = require('connect-sqlite3')
// load data constants from constants.js
const { users, songs, reviews } = require('./constants.js')

// set the port
const port = 8080

// set salt rounds
const saltRounds = 12

// create the server
const app = express()

/* ---HANDLEBARS--- */
app.engine('handlebars', engine()) // initialize the engine to be handlebars
app.set('view engine', 'handlebars') // set handlebars as the view engine
app.set('views', __dirname + '/views') // define the views directory to be ./views
/* ---------------- */

/* ---Admin User--- */
const adminUsername = 'admin'
const adminPassword = '$2b$12$aPTylgM76nWd2vie6w3yz.jvAjrmA.c3uY0hK6V/IEqqKjuDMgLc.' // password: admin
/* ---------------- */

/* ---Create the database--- */
dbName = 'music_reviews.db'
const db = new sqlite3.Database(dbName)
/* ------------------------- */

/* ---Session Management--- */
const SQLiteStore = connectSQLite3(session)

// Session configuration
app.use(session({
    store: new SQLiteStore({ db: "session-db.db" }),
    "saveUninitialized": false,
    "resave": false,
    "secret": "R4nd0mS3cr3t"
}))

// Store the session in the response locals
app.use(function (req, res, next) {
    res.locals.session = req.session
    next()
})
/* ------------------------- */

// Serve static files
app.use(express.static('public'))
// Parse JSON and URL encoded data
app.use(express.urlencoded({ extended: true }))

/* Create functions to create tables */
// Create the users table
function createUsersTable(db) {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        uid INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        isAdmin BOOLEAN NOT NULL DEFAULT FALSE
    )`, (err) => {
        if (err) {
            console.log(`There was an error creating the users table: ${err}`)
        } else {
            users.forEach(user => {
                password = bcrypt.hashSync(user.password, saltRounds)
                db.run(`INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)`, [user.username, password, user.isAdmin], (err) => {
                    if (err) {
                        console.log(`There was an error inserting the user: ${err}`)
                    } else {
                        console.log(`User ${user.username} inserted successfully!`)
                    }
                })
            });
        }
    })
}

// Create the songs table
function createSongsTable(db) {
    db.run(`CREATE TABLE IF NOT EXISTS songs (
        sid INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        genre TEXT NOT NULL,
        release_year INTEGER NOT NULL,
        cover_url TEXT
    )`, (err) => {
        if (err) {
            console.log(`There was an error creating the songs table: ${err}`)
        } else {
            songs.forEach(song => {
                db.run(`INSERT INTO songs (title, artist, album, genre, release_year, cover_url) VALUES (?, ?, ?, ?, ?, ?)`, [song.title, song.artist, song.album, song.genre, song.release_year, song.cover_url], (err) => {
                    if (err) {
                        console.log(`There was an error inserting the song: ${err}`)
                    } else {
                        console.log(`Song ${song.title} inserted successfully!`)
                    }
                })
            });
        }
    })
}

// Create the reviews table
function createReviewsTable(db) {
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        rid INTEGER PRIMARY KEY AUTOINCREMENT,
        sid INTEGER NOT NULL,
        uid INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        FOREIGN KEY(sid) REFERENCES songs(sid),
        FOREIGN KEY(uid) REFERENCES users(uid)
    )`, (err) => {
        if (err) {
            console.log(`There was an error creating the reviews table: ${err}`)
        } else {
            reviews.forEach(review => {
                db.run(`INSERT INTO reviews (sid, uid, rating, comment) VALUES (?, ?, ?, ?)`, [review.sid, review.uid, review.rating, review.comment], (err) => {
                    if (err) {
                        console.log(`There was an error inserting the review: ${err}`)
                    } else {
                        console.log(`Review ${review.comment} inserted successfully!`)
                    }
                })
            });
        }
    })
}

/* ---------------------------- */

app.get('/', (req, res) => {
    console.log(req.session)
    model = {
        'title': 'Home Page',
        isAdmin: req.session.isAdmin,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        uid: req.session.uid
    }
    res.render('home', model)
})

app.get('/songs', (req, res) => {
    // Get the songs from the database
    db.all(`SELECT * FROM songs`, (err, songs) => {
        if (err) {
            console.log(`There was an error getting the songs: ${err}`)
        } else {
            model = {
                'title': 'Songs Page',
                songs: songs
            }
            res.render('songs', model)
        }
    })
})

app.get('/song/:sid', (req, res) => {
    // Get the song from the database
    db.get(`SELECT * FROM songs WHERE sid = ?`, [req.params.sid], (err, song) => {
        if (err) {
            console.log(`There was an error getting the song: ${err}`)
        }
        if (song) {
            // Get reviews for the song
            db.all(`SELECT username, rating, comment
                FROM reviews r 
                INNER JOIN users u ON r.uid = u.uid
                WHERE r.sid = ?`, [req.params.sid], (err, reviews) => {
                if (err) {
                    console.log(`There was an error getting the reviews: ${err}`)
                } else {
                    db.get(`SELECT AVG(rating) as avg_rating FROM reviews WHERE sid = ?`, [req.params.sid], (err, avg_rating) => {
                        model = {
                            'title': 'Song Details Page',
                            song: song,
                            averageRating: avg_rating.avg_rating,
                            reviews: reviews
                        }
                        res.render('song', model)
                    })
                }
            })
        } else {
            model = {
                'title': 'Opps!',
                error: `Sorry, track id ${req.params.sid} is not available!`
            }
            return res.status(400).render('error', model)
        }
    })
})

app.get('/song/review/:sid', (req, res) => {
    // Get the song from the database
    db.get(`SELECT * FROM songs WHERE sid = ?`, [req.params.sid], (err, song) => {
        if (err) {
            console.log(`There was an error getting the song: ${err}`)
        }
        if (song) {
            model = {
                'title': 'Write Review Page',
                song: song
            }
            res.render('writeReview', model)
        } else {
            model = {
                'title': 'Opps!',
                error: `Sorry, track id ${req.params.sid} is not available!`
            }
            return res.status(400).render('error', model)
        }
    })
})

app.post('/song/review/:sid', (req, res) => {
    // Get rating and comment from the request
    const rating = req.body.rating
    const comment = req.body.comment

    // Insert the review into the database
    db.run(`INSERT INTO reviews (sid, uid, rating, comment) VALUES (?, ?, ?, ?)`, [req.params.sid, req.session.uid, rating, comment], (err) => {
        if (err) {
            console.log(`There was an error inserting the review: ${err}`)
        } else {
            res.redirect(`/song/${req.params.id}`)
        }
    })
})

app.get('/your-reviews', (req, res) => {
    // Get the reviews for the user
    db.all(`SELECT s.sid,r.rid, title, artist, cover_url, rating, comment
        FROM reviews r
        INNER JOIN songs s ON r.sid = s.sid
        WHERE r.uid = ?`, [req.session.uid], (err, reviews) => {
        if (err) {
            console.log(`There was an error getting the reviews: ${err}`)
        } else {
            model = {
                'title': 'Your Reviews Page',
                reviews: reviews
            }
            res.render('yourReviews', model)
        }
    })
})

app.get('/song/review/edit/:rid', (req, res) => {
    // Get the review from the data
    db.get(`SELECT *
        FROM reviews r
        INNER JOIN songs s ON r.sid = s.sid 
        WHERE rid = ?
        AND r.uid = ?`, [req.params.rid, req.session.uid], (err, result) => {
        if (err) {
            console.log(`There was an error getting the review: ${err}`)
        }
        if (result) {
            model = {
                'title': 'Edit Review Page',
                result: result
            }
            res.render('editReview', model)
        } else {
            model = {
                'title': 'Opps!',
                error: 'Review not found or you do not have permission to edit it!'
            }
            return res.status(400).render('error', model)
        }
    })
})

app.post('/song/review/edit/:rid', (req, res) => {
    // Get rating and comment from the request
    const rating = req.body.rating
    const comment = req.body.comment

    // Update the review in the database
    db.run(`UPDATE reviews SET rating = ?, comment = ? WHERE rid = ?`, [rating, comment, req.params.rid], (err) => {
        if (err) {
            console.log(`There was an error updating the review: ${err}`)
        } else {
            res.redirect('/your-reviews')
        }
    })
})

app.get('/about', (req, res) => {
    res.render('about', { 'title': 'About Page' })
})

app.get('/contact', (req, res) => {
    res.render('contact', { 'title': 'Contact Page' })
})

app.get('/login', (req, res) => {
    res.render('login', { 'title': 'Login Page' })
})

app.post('/login', (req, res) => {
    // Get the username and password from the request
    const username = req.body.username
    const password = req.body.password

    // Get the user from the database
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            console.log(`There was an error with login page: ${err}`)
        }
        if (user) {
            bcrypt.compare(password, user.password, (err, result) => {
                if (err) {
                    console.log(`There was an error with login page: ${err}`)
                }
                if (result) {
                    // Set the session variables
                    req.session.isLoggedIn = true
                    req.session.isAdmin = user.isAdmin
                    req.session.username = username
                    req.session.uid = user.uid

                    // Redirect to the home page
                    res.redirect('/')
                } else {
                    model = {
                        'title': 'Login Page',
                        error: 'Password is incorrect!'
                    }
                    // Render the login page with an error message
                    return res.status(400).render('login', model)
                }
            })
        } else {
            // Render the login page with an error message
            model = {
                'title': 'Login Page',
                error: 'Username is incorrect!'
            }
            return res.status(400).render('login', model)
        }
    })
})

app.get('/logout', (req, res) => {
    // Destroy the session
    req.session.destroy((err) => {
        if (err) {
            console.log('ERROR: ', err)
        }
        res.redirect('/')
    })
})

app.listen(port, function () {
    /* create tables */
    // createUsersTable(db)
    // createSongsTable(db)
    // createReviewsTable(db)
    /* ------------ */
    console.log(`Server up and running, listening on port ${port} -> http://localhost:${port}/`)
})