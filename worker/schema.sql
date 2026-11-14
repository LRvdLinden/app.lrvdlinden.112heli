-- 112Heli API (Cloudflare D1). Safe to run on every deploy.

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT,
  at INTEGER
);

-- Every followed aircraft that has been seen (hex = ICAO 24-bit address).
CREATE TABLE IF NOT EXISTS aircraft (
  hex TEXT PRIMARY KEY,
  akey TEXT,                       -- A-Alerts id: lifeliner3, zulu26, or the hex for other aircraft
  reg TEXT,
  callsign TEXT,
  soort TEXT NOT NULL,             -- trauma, politie, kustwacht, defensie, kmar, regering
  icoon TEXT,                      -- A-Alerts drawing (chinook, f35 …); NULL for Lifeliner/Zulu
  type TEXT,
  naam TEXT,
  basis TEXT,
  learn INTEGER NOT NULL DEFAULT 0, -- recognised for sure: remember the airframe for later flights
  updated_at INTEGER NOT NULL
);

-- Latest known state per aircraft.
CREATE TABLE IF NOT EXISTS state (
  hex TEXT PRIMARY KEY,
  lat REAL,
  lon REAL,
  alt INTEGER,
  gs REAL,
  track REAL,
  airborne INTEGER NOT NULL DEFAULT 0,
  seen_at INTEGER NOT NULL,
  airborne_since INTEGER,
  landed_at INTEGER,
  flight_id INTEGER,
  pos_at INTEGER
);

-- Positions while airborne (about every 20 s), kept 30 days.
CREATE TABLE IF NOT EXISTS positions (
  hex TEXT NOT NULL,
  ts INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  alt INTEGER,
  gs REAL,
  track REAL,
  flight_id INTEGER
);
CREATE INDEX IF NOT EXISTS positions_hex_ts ON positions (hex, ts);
CREATE INDEX IF NOT EXISTS positions_flight ON positions (flight_id);

CREATE TABLE IF NOT EXISTS flights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hex TEXT NOT NULL,
  start_ts INTEGER NOT NULL,
  end_ts INTEGER,
  start_lat REAL,
  start_lon REAL,
  start_place TEXT,
  end_lat REAL,
  end_lon REAL,
  end_place TEXT,                 -- "Geland bij …": hospital, base or place
  max_alt INTEGER
);
CREATE INDEX IF NOT EXISTS flights_start ON flights (start_ts);

-- Grote inzet: two or more helicopters at one spot that is not a hospital or base.
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_ts INTEGER NOT NULL,
  last_ts INTEGER NOT NULL,
  end_ts INTEGER,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  place TEXT,
  hexes TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS incidents_start ON incidents (start_ts);

-- Devices for pushmeldingen and their choices.
CREATE TABLE IF NOT EXISTS devices (
  token TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  environment TEXT NOT NULL,
  app_version TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  takeoff INTEGER NOT NULL DEFAULT 1,
  incidents INTEGER NOT NULL DEFAULT 1,
  fav_alerts INTEGER NOT NULL DEFAULT 1,
  soorten TEXT NOT NULL DEFAULT '["trauma","politie"]',
  favorites TEXT NOT NULL DEFAULT '[]',
  zones TEXT NOT NULL DEFAULT '[]',  -- own zones [{ naam, lat, lon, km }]: push when anything flies above them
  callsign INTEGER NOT NULL DEFAULT 1, -- push when a favourite changes callsign
  lat REAL,
  lon REAL,
  radius_km INTEGER NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Live Activities (iPhone lock screen) following one aircraft.
CREATE TABLE IF NOT EXISTS activities (
  token TEXT PRIMARY KEY,
  hex TEXT NOT NULL,
  environment TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_sent INTEGER NOT NULL DEFAULT 0
);

-- Zone pushes already sent (one per aircraft per zone per hour).
CREATE TABLE IF NOT EXISTS zone_hits (
  token TEXT NOT NULL,
  hex TEXT NOT NULL,
  zone TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (token, hex, zone)
);

-- "Dit toestel ontbreekt of klopt niet" from the app, read in beheer.
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  hex TEXT,
  naam TEXT,
  reg TEXT,
  soort TEXT,
  tekst TEXT NOT NULL,
  platform TEXT,
  app_version TEXT,
  status TEXT NOT NULL DEFAULT 'nieuw'
);

-- Own pushmeldingen sent from beheer.
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  titel TEXT,
  tekst TEXT NOT NULL,
  soorten TEXT NOT NULL DEFAULT '[]',
  bereik INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 0,
  fout INTEGER NOT NULL DEFAULT 0
);
