--
-- PostgreSQL database dump
--

\restrict KwiN9ztufjrZC5Ojs5RA8CYlIOxbhsEWbX1SLfGHKCxreBUg8cssvzOJlL83n9x

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 17.8 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: expire_old_accounts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_old_accounts() RETURNS TABLE(expired_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Mark all expired anonymous accounts
  WITH expired_users AS (
    UPDATE users
    SET auth_type = 'expired',
        anonymous_id = NULL
    WHERE auth_type = 'anonymous'
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO count FROM expired_users;

  RETURN QUERY SELECT count;
END;
$$;


ALTER FUNCTION public.expire_old_accounts() OWNER TO postgres;

--
-- Name: FUNCTION expire_old_accounts(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.expire_old_accounts() IS 'Run daily via cron to mark expired anonymous accounts (soft delete)';


--
-- Name: find_user_by_reset_token(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.find_user_by_reset_token(token character varying) RETURNS TABLE(id uuid, email character varying, display_name character varying, password_reset_expires timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.password_reset_expires
  FROM users u
  WHERE u.password_reset_token = token
    AND u.password_reset_expires > NOW();
END;
$$;


ALTER FUNCTION public.find_user_by_reset_token(token character varying) OWNER TO postgres;

--
-- Name: find_user_by_verification_token(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.find_user_by_verification_token(token character varying) RETURNS TABLE(id uuid, email character varying, display_name character varying, email_verification_expires timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.display_name, u.email_verification_expires
  FROM users u
  WHERE u.email_verification_token = token
    AND u.email_verification_expires > NOW();
END;
$$;


ALTER FUNCTION public.find_user_by_verification_token(token character varying) OWNER TO postgres;

--
-- Name: generate_anonymous_display_name(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_anonymous_display_name() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  year VARCHAR(4);
  random_id VARCHAR(6);
  name VARCHAR(50);
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  year := EXTRACT(YEAR FROM NOW())::VARCHAR;

  -- Try to generate unique random display name
  LOOP
    -- Generate random 6-digit number (000000-999999)
    -- Format: ~YYYY-NNNNNN (e.g., ~2026-472935)
    random_id := LPAD(FLOOR(RANDOM() * 1000000)::VARCHAR, 6, '0');
    name := '~' || year || '-' || random_id;

    -- Check if this name already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE display_name = name) THEN
      RETURN name;
    END IF;

    -- Prevent infinite loop (very unlikely with 1M possibilities)
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      -- Fallback: add timestamp suffix
      name := '~' || year || '-' || random_id || '-' || EXTRACT(EPOCH FROM NOW())::VARCHAR;
      RETURN name;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.generate_anonymous_display_name() OWNER TO postgres;

--
-- Name: FUNCTION generate_anonymous_display_name(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.generate_anonymous_display_name() IS 'Generates Wikipedia-style temporary account names with random 6-digit ID (e.g., ~2026-472935)';


--
-- Name: handle_expired_account(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_expired_account(old_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
  new_user_id UUID;
  old_display_name VARCHAR(100);
BEGIN
  -- Get old display name for logging
  SELECT display_name INTO old_display_name
  FROM users
  WHERE id = old_user_id;

  -- Mark user as expired (don't delete - keep citations visible)
  UPDATE users
  SET auth_type = 'expired',
      anonymous_id = NULL  -- Clear anonymous_id so they can't auth anymore
  WHERE id = old_user_id;

  -- Log the expiry
  INSERT INTO user_stats (user_id, warnings)
  VALUES (old_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN old_user_id;
END;
$$;


ALTER FUNCTION public.handle_expired_account(old_user_id uuid) OWNER TO postgres;

--
-- Name: increment_citation_count(uuid, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_citation_count(p_user_id uuid, p_video_id character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Update user stats
  INSERT INTO user_stats (user_id, total_citations, citations_today, citations_this_hour)
  VALUES (p_user_id, 1, 1, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    total_citations = user_stats.total_citations + 1,
    citations_today = user_stats.citations_today + 1,
    citations_this_hour = user_stats.citations_this_hour + 1,
    updated_at = NOW();

  -- Update users table
  UPDATE users
  SET citations_count = citations_count + 1,
      last_citation_at = NOW()
  WHERE id = p_user_id;

  -- Update video-specific counts
  INSERT INTO video_citation_counts (user_id, video_id, citation_count)
  VALUES (p_user_id, p_video_id, 1)
  ON CONFLICT (user_id, video_id) DO UPDATE SET
    citation_count = video_citation_counts.citation_count + 1,
    last_citation_at = NOW();
END;
$$;


ALTER FUNCTION public.increment_citation_count(p_user_id uuid, p_video_id character varying) OWNER TO postgres;

--
-- Name: is_user_expired(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_user_expired(user_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  expiry TIMESTAMP;
BEGIN
  SELECT expires_at INTO expiry
  FROM users
  WHERE id = user_id;

  -- Registered users (expires_at = NULL) never expire
  IF expiry IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if expiry date has passed
  RETURN expiry < NOW();
END;
$$;


ALTER FUNCTION public.is_user_expired(user_id uuid) OWNER TO postgres;

--
-- Name: reset_daily_counters(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_daily_counters() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE user_stats
  SET citations_today = 0,
      citations_last_reset = NOW()
  WHERE citations_last_reset < NOW() - INTERVAL '24 hours';
END;
$$;


ALTER FUNCTION public.reset_daily_counters() OWNER TO postgres;

--
-- Name: reset_hourly_counters(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reset_hourly_counters() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE user_stats
  SET citations_this_hour = 0,
      rapid_fire_count = 0,
      last_rapid_fire_reset = NOW()
  WHERE last_rapid_fire_reset < NOW() - INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION public.reset_hourly_counters() OWNER TO postgres;

--
-- Name: set_anonymous_expiry(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_anonymous_expiry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Anonymous users: expire in 90 days
  IF NEW.auth_type = 'anonymous' THEN
    NEW.expires_at = COALESCE(NEW.account_created_at, NOW()) + INTERVAL '90 days';

    -- Generate display name if not provided
    IF NEW.display_name IS NULL THEN
      NEW.display_name = generate_anonymous_display_name();
    END IF;

  -- Registered users: never expire
  ELSIF NEW.auth_type IN ('password', 'google') THEN
    NEW.expires_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_anonymous_expiry() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    admin_id uuid NOT NULL,
    action_type character varying(50) NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id uuid NOT NULL,
    reason text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.admin_actions OWNER TO postgres;

--
-- Name: rate_limit_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type character varying(50) NOT NULL,
    video_id character varying(20),
    ip_address inet,
    user_agent text,
    limit_type character varying(50),
    limit_value integer,
    current_count integer,
    blocked boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.rate_limit_events OWNER TO postgres;

--
-- Name: shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    share_token character varying(8) NOT NULL,
    user_id uuid NOT NULL,
    video_id character varying(20) NOT NULL,
    title character varying(255),
    annotations jsonb NOT NULL,
    is_public boolean DEFAULT true,
    view_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    deleted_by_admin uuid,
    deleted_at timestamp without time zone,
    deletion_reason text
);


ALTER TABLE public.shares OWNER TO postgres;

--
-- Name: COLUMN shares.deleted_by_admin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.shares.deleted_by_admin IS 'Admin user ID who deleted this citation';


--
-- Name: user_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_stats (
    user_id uuid NOT NULL,
    total_citations integer DEFAULT 0,
    citations_today integer DEFAULT 0,
    citations_this_hour integer DEFAULT 0,
    citations_last_reset timestamp without time zone DEFAULT now(),
    rapid_fire_count integer DEFAULT 0,
    last_rapid_fire_reset timestamp without time zone DEFAULT now(),
    duplicate_text_count integer DEFAULT 0,
    cross_video_spam_count integer DEFAULT 0,
    warnings integer DEFAULT 0,
    suspensions integer DEFAULT 0,
    last_warning_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_stats OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    anonymous_id character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    auth_type character varying(50) DEFAULT 'anonymous'::character varying,
    email character varying(255),
    display_name character varying(100),
    password_hash character varying(255),
    email_verified boolean DEFAULT false,
    email_verification_token character varying(255),
    email_verification_expires timestamp without time zone,
    password_reset_token character varying(255),
    password_reset_expires timestamp without time zone,
    linked_anonymous_id character varying(255),
    account_created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone,
    citations_count integer DEFAULT 0,
    last_citation_at timestamp without time zone,
    is_rate_limited boolean DEFAULT false,
    rate_limit_until timestamp without time zone,
    is_admin boolean DEFAULT false,
    is_suspended boolean DEFAULT false,
    suspended_until timestamp without time zone,
    suspension_reason text,
    is_blocked boolean DEFAULT false,
    blocked_at timestamp without time zone,
    blocked_reason text,
    CONSTRAINT users_auth_type_check CHECK (((auth_type)::text = ANY ((ARRAY['anonymous'::character varying, 'password'::character varying, 'google'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email IS 'User email address (unique, required for registered users)';


--
-- Name: COLUMN users.display_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.display_name IS 'Public display name: ~YYYY-NNNNNN (random) for anonymous, user-chosen for registered';


--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password_hash IS 'bcrypt hashed password (12 rounds)';


--
-- Name: COLUMN users.email_verified; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email_verified IS 'Whether email address has been verified';


--
-- Name: COLUMN users.email_verification_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email_verification_token IS 'Token for email verification (expires in 24 hours)';


--
-- Name: COLUMN users.password_reset_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password_reset_token IS 'Token for password reset (expires in 1 hour)';


--
-- Name: COLUMN users.linked_anonymous_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.linked_anonymous_id IS 'If upgraded from anonymous, stores original anonymous_id';


--
-- Name: COLUMN users.is_admin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.is_admin IS 'True if user has admin privileges';


--
-- Name: COLUMN users.is_suspended; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.is_suspended IS 'True if user is temporarily suspended';


--
-- Name: COLUMN users.suspended_until; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.suspended_until IS 'When the suspension expires (NULL = not suspended)';


--
-- Name: COLUMN users.is_blocked; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.is_blocked IS 'True if user is permanently blocked';


--
-- Name: video_citation_counts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.video_citation_counts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    video_id character varying(20) NOT NULL,
    citation_count integer DEFAULT 0,
    first_citation_at timestamp without time zone DEFAULT now(),
    last_citation_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.video_citation_counts OWNER TO postgres;

--
-- Data for Name: admin_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_actions (id, admin_id, action_type, target_type, target_id, reason, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: rate_limit_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rate_limit_events (id, user_id, event_type, video_id, ip_address, user_agent, limit_type, limit_value, current_count, blocked, created_at) FROM stdin;
\.


--
-- Data for Name: shares; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shares (id, share_token, user_id, video_id, title, annotations, is_public, view_count, created_at, updated_at, deleted_by_admin, deleted_at, deletion_reason) FROM stdin;
629f7235-9957-49a2-90e0-47594a7810e0	ndtwluqi	d1c92149-f17f-4c13-b632-7a203cae18b5	f0p_jlvu334	The Devil Wears Prada is Scorsese for Women - Annotations	[{"id": "1770568905014", "text": "bad word", "citation": null, "createdAt": "2026-02-08T16:41:45.014Z", "timestamp": 977.241748}, {"id": "1770952172426", "text": "Test with anonymous", "citation": null, "createdAt": "2026-02-13T03:09:32.426Z", "timestamp": 1515.112159}, {"id": "1770952655111", "text": "Test regular, logged out.", "citation": null, "createdAt": "2026-02-13T03:17:35.111Z", "timestamp": 1722.133789}]	t	39	2026-02-08 16:41:45.262615	2026-02-13 03:17:35.414176	\N	\N	\N
303d3cf1-eed0-42b2-b0ac-e11b13853e7b	5uqpy6z9	46933d38-c788-443b-b12d-855d0c6b32e8	EgRxxQZKwuM	How to Buy the Moon - Annotations	[{"id": "1770334758202", "text": "Regular 6:39!", "createdAt": "2026-02-05T23:39:18.202Z", "timestamp": 575.096057}]	t	6	2026-02-05 23:39:41.430254	2026-02-05 23:39:55.244722	\N	\N	\N
52b05184-d8e9-4b46-9669-138e20a7b5fe	f6pcceuz	97fbb5cc-e753-477d-82fe-1211002b51dc	EgRxxQZKwuM	How to Buy the Moon - Annotations	[{"id": "1770334758202", "text": "Regular 6:39!", "createdAt": "2026-02-05T23:39:18.202Z", "timestamp": 575.096057}]	t	15	2026-02-05 23:38:41.421774	2026-02-05 23:39:27.872699	\N	\N	\N
6c18403b-40cf-4c01-a402-4a0b13552453	smqacmml	ccd861e4-e223-4685-b45a-b3dc04b86cf1	dQw4w9WgXcQ	Test Video	[{"id": "test1", "text": "Test annotation with JWT", "color": "#ff0000", "timestamp": 30}]	t	1	2026-02-13 02:54:49.862066	2026-02-13 02:54:49.862066	\N	\N	\N
8d4ea4a7-0701-4ec0-9cbf-36ca6874f1a7	u33a4fv4	46933d38-c788-443b-b12d-855d0c6b32e8	f0p_jlvu334	The Devil Wears Prada is Scorsese for Women - Annotations	[{"id": "1770344226104", "text": "lulz", "citation": {"day": "", "url": "GOOBER", "type": "article", "year": "", "month": "", "title": "OFFENSIVE STRING", "author": ""}, "createdAt": "2026-02-06T02:17:06.104Z", "timestamp": 1914.134776}, {"id": "1770344285858", "text": "Where's my first one?", "citation": null, "createdAt": "2026-02-06T02:18:05.858Z", "timestamp": 1186.430871}, {"id": "1770344299395", "text": "Got 'em!", "citation": null, "createdAt": "2026-02-06T02:18:19.395Z", "timestamp": 2660.546651}]	t	70	2026-02-06 02:05:52.550403	2026-02-06 02:18:19.657919	\N	\N	\N
2e3af0d8-1033-4e83-9272-76f384a5839a	f1kjbzb2	d1c92149-f17f-4c13-b632-7a203cae18b5	TsiHtJbc-sE	Remaking Kids by MGMT to Learn Why It’s So Good - Annotations	[{"id": "1770566760264", "text": "", "citation": {"type": "movie", "year": "", "title": "Title of film", "director": ""}, "createdAt": "2026-02-08T16:06:00.264Z", "timestamp": 599.282555}]	t	1	2026-02-08 16:06:00.555025	2026-02-08 16:06:00.555025	\N	\N	\N
fc68e0c3-541a-4b75-aa2e-21e2630aac74	3dc9d1mg	d1c92149-f17f-4c13-b632-7a203cae18b5	X8Ly-BgyHPs	I Turned Down $7,000 For This - Annotations	[{"id": "1770848684162", "text": "Leg Profile", "citation": null, "createdAt": "2026-02-11T22:24:44.162Z", "timestamp": 1054.004256}, {"id": "1770848852275", "text": "Four piece template shot", "citation": null, "createdAt": "2026-02-11T22:27:32.275Z", "timestamp": 1081.606888}, {"id": "1770852152103", "text": "Finish Profile", "citation": null, "createdAt": "2026-02-11T23:22:32.103Z", "timestamp": 1682.398759}, {"id": "1770852228113", "text": "Finish Detail", "citation": null, "createdAt": "2026-02-11T23:23:48.113Z", "timestamp": 1714.235206}, {"id": "1770854341173", "text": "Tenon Map", "citation": null, "createdAt": "2026-02-11T23:59:01.173Z", "timestamp": 1402.310728}, {"id": "1770854560409", "text": "Side Shot of Assembly", "citation": null, "createdAt": "2026-02-12T00:02:40.409Z", "timestamp": 1433.232059}]	t	7	2026-02-11 22:24:44.844568	2026-02-12 00:02:40.874039	\N	\N	\N
f519f1ae-de8d-4c6a-8c9c-c15f6c28ef76	jflmppvv	aea20208-88fb-4fe0-ab80-f9626694e4a0	f0p_jlvu334	The Devil Wears Prada is Scorsese for Women - Annotations	[{"id": "1770952729876", "text": "Test incognito, logged out.", "citation": null, "createdAt": "2026-02-13T03:18:49.876Z", "timestamp": 2425.580929}]	t	28	2026-02-13 03:18:50.380183	2026-02-13 03:18:50.380183	\N	\N	\N
5b85c07a-9162-4b23-bdf3-c2e455cffc26	30d2774l	97fbb5cc-e753-477d-82fe-1211002b51dc	f0p_jlvu334	The Devil Wears Prada is Scorsese for Women - Annotations	[{"id": "1770337492830", "text": "The Devil Wears Prada (2006)", "createdAt": "2026-02-06T00:24:52.830Z", "timestamp": 123.537524}, {"id": "1770338255586", "text": "", "citation": {"day": "2", "url": "https://www.newyorker.com/magazine/2006/07/10/dressed-to-kill", "type": "article", "year": "2006", "month": "July", "title": "Dressed to Kill", "author": "David Denby"}, "createdAt": "2026-02-06T00:37:35.586Z", "timestamp": 193.956127}, {"id": "1770338394130", "text": "", "citation": {"type": "movie", "year": "1987", "title": "Wall Street", "director": "Oliver Stone"}, "createdAt": "2026-02-06T00:39:54.130Z", "timestamp": 233.892777}, {"id": "1770340120473", "text": "Placeholder", "citation": null, "createdAt": "2026-02-06T01:08:40.473Z", "timestamp": 2263.538239}, {"id": "1770340132460", "text": "placeholder 2", "citation": null, "createdAt": "2026-02-06T01:08:52.460Z", "timestamp": 2594.333043}]	t	123	2026-02-06 00:24:53.458336	2026-02-06 01:08:52.770635	\N	\N	\N
\.


--
-- Data for Name: user_stats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_stats (user_id, total_citations, citations_today, citations_this_hour, citations_last_reset, rapid_fire_count, last_rapid_fire_reset, duplicate_text_count, cross_video_spam_count, warnings, suspensions, last_warning_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, anonymous_id, created_at, auth_type, email, display_name, password_hash, email_verified, email_verification_token, email_verification_expires, password_reset_token, password_reset_expires, linked_anonymous_id, account_created_at, expires_at, citations_count, last_citation_at, is_rate_limited, rate_limit_until, is_admin, is_suspended, suspended_until, suspension_reason, is_blocked, blocked_at, blocked_reason) FROM stdin;
97fbb5cc-e753-477d-82fe-1211002b51dc	CpOtC_m8uKYk5O1elc7tdw	2026-02-05 23:31:35.583082	anonymous	\N	~2026-438238	\N	f	\N	\N	\N	\N	\N	2026-02-13 02:34:29.176236	2026-05-14 02:34:29.176236	0	\N	f	\N	f	f	\N	\N	f	\N	\N
46933d38-c788-443b-b12d-855d0c6b32e8	2wQMFe9CTEp6idSbp9V-iQ	2026-02-05 23:32:53.039073	anonymous	\N	~2026-664427	\N	f	\N	\N	\N	\N	\N	2026-02-13 02:34:29.176236	2026-05-14 02:34:29.176236	0	\N	f	\N	f	f	\N	\N	f	\N	\N
ef47861a-9a1e-4f52-8d84-2bb1d0c5c21d	oo1zmXtmmNPF-EXEtA5uPA	2026-02-08 13:48:47.022787	anonymous	\N	~2026-138223	\N	f	\N	\N	\N	\N	\N	2026-02-13 02:34:29.176236	2026-05-14 02:34:29.176236	0	\N	f	\N	f	f	\N	\N	f	\N	\N
9470168e-ca30-484b-87be-c18a05b5925b	zREwdTKXQsn2VmAKE0tFjg	2026-02-08 14:19:44.609377	anonymous	\N	~2026-600413	\N	f	\N	\N	\N	\N	\N	2026-02-13 02:34:29.176236	2026-05-14 02:34:29.176236	0	\N	f	\N	f	f	\N	\N	f	\N	\N
ccd861e4-e223-4685-b45a-b3dc04b86cf1	NY2g2JLOncT1qULeVfMCYw	2026-02-13 02:42:54.665069	password	test@example.com	Test User	$2b$12$FDnF6pkTiK61GdZm1dxyT.km6XRmLLtemxZvfZGluQcUD6n2rZMA6	t	\N	\N	\N	\N	NY2g2JLOncT1qULeVfMCYw	2026-02-13 02:42:54.665069	\N	0	\N	f	\N	f	f	\N	\N	f	\N	\N
6c4b682a-7555-470b-a85e-b7550a05051d	E57_bi1BeTrFwLF20PWXJg	2026-02-13 03:10:36.701858	anonymous	\N	~2026-745753	\N	f	\N	\N	\N	\N	\N	2026-02-13 03:10:36.701858	2026-05-14 03:10:36.701858	0	\N	f	\N	f	f	\N	\N	f	\N	\N
aea20208-88fb-4fe0-ab80-f9626694e4a0	Sasu9veIqWQEQl2H7JJF0A	2026-02-13 03:10:36.702636	anonymous	\N	~2026-996938	\N	f	\N	\N	\N	\N	\N	2026-02-13 03:10:36.702636	2026-05-14 03:10:36.702636	0	\N	f	\N	f	f	\N	\N	f	\N	\N
d1c92149-f17f-4c13-b632-7a203cae18b5	3h2OIoYWIzD5JopUb02wDA	2026-02-06 02:36:34.522053	anonymous	\N	~2026-739785	\N	f	\N	\N	\N	\N	\N	2026-02-13 02:34:29.176236	2026-05-14 02:34:29.176236	0	\N	f	\N	f	f	\N	\N	f	\N	\N
\.


--
-- Data for Name: video_citation_counts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.video_citation_counts (id, user_id, video_id, citation_count, first_citation_at, last_citation_at) FROM stdin;
\.


--
-- Name: admin_actions admin_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_events rate_limit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limit_events
    ADD CONSTRAINT rate_limit_events_pkey PRIMARY KEY (id);


--
-- Name: shares shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_pkey PRIMARY KEY (id);


--
-- Name: shares shares_share_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_share_token_key UNIQUE (share_token);


--
-- Name: user_stats user_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_pkey PRIMARY KEY (user_id);


--
-- Name: users users_anonymous_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_anonymous_id_key UNIQUE (anonymous_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: video_citation_counts video_citation_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_citation_counts
    ADD CONSTRAINT video_citation_counts_pkey PRIMARY KEY (id);


--
-- Name: video_citation_counts video_citation_counts_user_id_video_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_citation_counts
    ADD CONSTRAINT video_citation_counts_user_id_video_id_key UNIQUE (user_id, video_id);


--
-- Name: idx_admin_actions_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_actions_admin ON public.admin_actions USING btree (admin_id);


--
-- Name: idx_admin_actions_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_actions_created ON public.admin_actions USING btree (created_at DESC);


--
-- Name: idx_admin_actions_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_actions_target ON public.admin_actions USING btree (target_type, target_id);


--
-- Name: idx_rate_limit_events_blocked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_limit_events_blocked ON public.rate_limit_events USING btree (blocked);


--
-- Name: idx_rate_limit_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_limit_events_created_at ON public.rate_limit_events USING btree (created_at);


--
-- Name: idx_rate_limit_events_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_limit_events_user_id ON public.rate_limit_events USING btree (user_id);


--
-- Name: idx_shares_annotations; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shares_annotations ON public.shares USING gin (annotations);


--
-- Name: idx_shares_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shares_created_at ON public.shares USING btree (created_at DESC);


--
-- Name: idx_shares_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shares_token ON public.shares USING btree (share_token);


--
-- Name: idx_shares_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shares_user_created ON public.shares USING btree (user_id, created_at DESC);


--
-- Name: idx_shares_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shares_user_id ON public.shares USING btree (user_id);


--
-- Name: idx_shares_video_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shares_video_id ON public.shares USING btree (video_id);


--
-- Name: idx_shares_video_public; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shares_video_public ON public.shares USING btree (video_id, is_public, created_at DESC);


--
-- Name: idx_user_stats_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_stats_user_id ON public.user_stats USING btree (user_id);


--
-- Name: idx_users_anonymous_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_anonymous_id ON public.users USING btree (anonymous_id);


--
-- Name: idx_users_auth_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_auth_type ON public.users USING btree (auth_type);


--
-- Name: idx_users_display_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_display_name ON public.users USING btree (display_name);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_email_verification_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email_verification_token ON public.users USING btree (email_verification_token);


--
-- Name: idx_users_password_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_password_reset_token ON public.users USING btree (password_reset_token);


--
-- Name: idx_video_citation_counts_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_video_citation_counts_lookup ON public.video_citation_counts USING btree (user_id, video_id);


--
-- Name: users set_user_expiry_and_display_name; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_user_expiry_and_display_name BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_anonymous_expiry();


--
-- Name: admin_actions admin_actions_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: rate_limit_events rate_limit_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limit_events
    ADD CONSTRAINT rate_limit_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shares shares_deleted_by_admin_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_deleted_by_admin_fkey FOREIGN KEY (deleted_by_admin) REFERENCES public.users(id);


--
-- Name: shares shares_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_stats user_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: video_citation_counts video_citation_counts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.video_citation_counts
    ADD CONSTRAINT video_citation_counts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict KwiN9ztufjrZC5Ojs5RA8CYlIOxbhsEWbX1SLfGHKCxreBUg8cssvzOJlL83n9x

