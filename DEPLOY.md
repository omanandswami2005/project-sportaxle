# Deploying Sports Axle on EC2

Everything runs on one EC2 instance with Docker Compose:

```
Browser ──► EC2 :80 ──► app container (FastAPI + built React site)
                              │
                              ▼
                        db container (Postgres 17, data in the `pgdata` volume)

S3 bucket ──(aws s3 cp, once)──► EC2 data/ ──(make docker-feed)──► Postgres
```

S3 only holds the **raw exports** (the Forms `.xlsx`, `captains.zip` and the players' photo
zip). The EC2 instance downloads them once, and `make docker-feed` loads teams, players and
**all photos into Postgres**. The site then serves photos from the database, so the app never
needs to reach S3 after that.

## 1. AWS setup (once)

1. **S3:** create a private bucket in the same account and upload the three files, for example:
   ```
   aws s3 cp form.xlsx     s3://YOUR-BUCKET/sportsaxle/form.xlsx
   aws s3 cp captains.zip  s3://YOUR-BUCKET/sportsaxle/captains.zip
   aws s3 cp players.zip   s3://YOUR-BUCKET/sportsaxle/players.zip
   ```
   Keep the bucket private: it holds staff names, emails and photos.
2. **IAM role for the instance:** create a role for EC2 with read-only access to that prefix and
   attach it to the instance (no access keys on the server):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::YOUR-BUCKET",
         "Condition": { "StringLike": { "s3:prefix": "sportsaxle/*" } } },
       { "Effect": "Allow", "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::YOUR-BUCKET/sportsaxle/*" }
     ]
   }
   ```
3. **EC2 instance:** Amazon Linux 2023, **t3.small or larger** (building the site needs about
   1 GB of memory), 20 GB disk, with the role above attached.
4. **Security group:** allow inbound **80** (HTTP) from the people who need the site, and **22**
   (SSH) from your own IP only. Do **not** open 5432: Postgres only listens inside the instance.

## 2. Prepare the server (once)

```
ssh ec2-user@<EC2-PUBLIC-IP>

sudo dnf install -y docker git make
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
exit        # log out and back in so the docker group applies
```

The AWS CLI is already installed on Amazon Linux 2023.

## 3. Get the code and configure it

```
ssh ec2-user@<EC2-PUBLIC-IP>
git clone <REPO-URL> sportaxle && cd sportaxle
cp .env.example .env
nano .env
```

Fill in `.env`:

| Variable | Value |
|---|---|
| `POSTGRES_PASSWORD` | any long random string |
| `SECRET_KEY` | 32+ random characters: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ADMIN_PIN` | the auctioneer's access code, 8+ characters |
| `PORT` | `80` |
| `S3_DATA` | `s3://YOUR-BUCKET/sportsaxle/` |
| `FORM`, `CAPTAINS`, `PLAYERS` | only if your file names differ from `form.xlsx`, `captains.zip`, `players.zip` |
| `BID_INCREMENT`, `BID_SECONDS` | optional, default 100 and 30 |

The app refuses to start if `SECRET_KEY` or `ADMIN_PIN` is missing or too short.

## 4. Start it

```
make up          # builds the image, starts Postgres and the app
docker compose ps    # both should say "healthy"
```

Open `http://<EC2-PUBLIC-IP>/`. The site is up but empty until you load the data.

## 5. Load the real data (xlsx + 2 zips)

```
make pull-data       # aws s3 cp $S3_DATA -> data/
ls data/             # form.xlsx  captains.zip  players.zip
make docker-feed     # loads everything into Postgres
```

What `docker-feed` does:

- **`captains.zip`**: one photo per captain, named `<anything>_<Captain Name>.jpg`. Each captain
  gets a team ("Team <first name>"), a colour, a purse of 10,000 and a **random access code**.
- **`form.xlsx`**: the Microsoft Forms export ("Open in Excel"). It must have the columns
  *Full Name*, *Department*, *Profile Photograph…* and *Which sports…*; if one is missing the
  command says which.
- **`players.zip`**: the form's uploaded photos ("Download all files" on the Forms responses).
  It must cover **all** responses in the xlsx; players without a matching file are listed as
  "No photo for: …" and appear without a photo.
- Photos are resized and stored as WebP in Postgres.

The captain codes are written to **`data/captain-codes.csv`** and shown nowhere else:

```
cat data/captain-codes.csv
```

Send each captain their own code privately. Then remove the raw files from the server:

```
rm data/*.xlsx data/*.zip        # keep captain-codes.csv somewhere safe, then delete it too
```

To change purse, base price or squad limit, run the command by hand instead of `make docker-feed`:

```
docker compose run --rm --user "$(id -u):$(id -g)" -v "$PWD/data:/data" app \
  python -m app.feed --captains /data/captains.zip --form /data/form.xlsx \
  --players-zip /data/players.zip --codes /data/captain-codes.csv \
  --purse 10000 --base-price 500 --squad-limit 12
```

### Loading again from scratch

`docker-feed` only loads into an **empty** database. To start over (this deletes teams,
players, bids, results and photos, with no undo):

```
make docker-wipe
make docker-feed
```

## 6. Day-to-day commands

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `make logs` |
| Restart | `docker compose restart app` |
| Stop (data is kept) | `make down` |
| Start again | `make up` |
| Deploy new code | `git pull && make up` |
| Postgres shell | `docker compose exec db psql -U sportsaxle sportsaxle` |
| Back up the database | `docker compose exec -T db pg_dump -U sportsaxle sportsaxle > backup-$(date +%F).sql` |

To restore a backup (replaces everything in the database):

```
docker compose stop app
docker compose exec -T db psql -U sportsaxle sportsaxle -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose exec -T db psql -U sportsaxle sportsaxle < backup-YYYY-MM-DD.sql
docker compose start app
```

Containers restart on their own after a crash or a reboot (`restart: unless-stopped`).
Restarts and redeploys keep all data: it lives in the `pgdata` volume. **`docker compose down -v`
deletes that volume, and with it every bid and result.** Take a backup before the auction and
copy it off the server (for example `aws s3 cp backup.sql s3://YOUR-BUCKET/backups/`; the role
above would then also need `s3:PutObject` on that prefix).

## 7. Test run, then reset

Run a full rehearsal with real captains on the real server, then clear it:

1. Sign in as the auctioneer, open **Admin → Reset the auction**, type `RESET`, press
   **Reset auction**.
2. Every player is Available again with no team or price, nothing is on the block and every
   purse is full. Teams, captains, access codes, players, photos, matches and the squad limit
   are kept, so you do **not** need to load the data again.

To set everyone's starting price before the auction, use **Admin → Base price for all
players** (it skips sold players and the one on the block). One player's price can still be
changed under that player's **Edit**.

## 8. Before the event

- Log in as the auctioneer with `ADMIN_PIN` and check every team and player.
- Log in as one captain with a code from `captain-codes.csv`.
- Take a database backup.
- Changing `ADMIN_PIN` in `.env` and running `make up` signs out every auctioneer session.

The site is plain HTTP on port 80. If it is reachable from outside the office network, put HTTPS
in front of it (for example an Application Load Balancer with an ACM certificate), because
access codes are sent with each login.
