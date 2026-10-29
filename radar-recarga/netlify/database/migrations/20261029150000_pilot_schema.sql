CREATE TABLE pilot_points (
	id text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	cpo_id text NOT NULL,
	city text NOT NULL,
	uf text NOT NULL,
	lat double precision NOT NULL,
	lng double precision NOT NULL,
	address text NOT NULL,
	raw text NOT NULL,
	first_seen_at text NOT NULL,
	last_seen_at text NOT NULL
);

CREATE TABLE pilot_runs (
	id text PRIMARY KEY NOT NULL,
	started_at text NOT NULL,
	finished_at text,
	status text NOT NULL,
	count integer DEFAULT 0 NOT NULL,
	error text
);

CREATE INDEX pilot_runs_time_idx ON pilot_runs (started_at);
CREATE TABLE pilot_samples (
	run_id text NOT NULL,
	point_id text NOT NULL,
	observed_at text NOT NULL,
	status text NOT NULL,
	PRIMARY KEY(run_id, point_id),
	FOREIGN KEY (run_id) REFERENCES pilot_runs(id) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (point_id) REFERENCES pilot_points(id) ON UPDATE no action ON DELETE no action
);

CREATE INDEX pilot_samples_point_time_idx ON pilot_samples (point_id,observed_at);