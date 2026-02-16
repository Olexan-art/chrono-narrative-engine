-- Data Migration Script (Deduplicated)

-- 1. Migrate Countries
INSERT INTO public.news_countries (id, name, code, flag, is_active, retell_ratio, created_at, updated_at)
VALUES ('6a1d4330-24c0-44e7-b486-5cfaa969d6b2', 'Польща', 'PL', '🇵🇱', true, 20, '2026-01-26T13:41:34.791787+00:00', '2026-02-02T12:30:33.218687+00:00')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, flag = EXCLUDED.flag, is_active = EXCLUDED.is_active, retell_ratio = EXCLUDED.retell_ratio;

INSERT INTO public.news_countries (id, name, code, flag, is_active, retell_ratio, created_at, updated_at)
VALUES ('1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'США', 'US', '🇺🇸', true, 100, '2026-01-26T13:41:34.791787+00:00', '2026-02-06T12:54:23.718412+00:00')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, flag = EXCLUDED.flag, is_active = EXCLUDED.is_active, retell_ratio = EXCLUDED.retell_ratio;

INSERT INTO public.news_countries (id, name, code, flag, is_active, retell_ratio, created_at, updated_at)
VALUES ('f07acf0c-d33c-464c-a208-a456205e012f', 'Індія', 'IN', '🇮🇳', true, 10, '2026-01-26T13:41:34.791787+00:00', '2026-02-09T10:30:01.055327+00:00')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, flag = EXCLUDED.flag, is_active = EXCLUDED.is_active, retell_ratio = EXCLUDED.retell_ratio;

INSERT INTO public.news_countries (id, name, code, flag, is_active, retell_ratio, created_at, updated_at)
VALUES ('816cd62f-df7a-451e-8356-879dffd97d16', 'Велика Британія', 'GB', '🇬🇧', true, 80, '2026-02-09T10:24:30.144566+00:00', '2026-02-09T10:30:07.917784+00:00')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, flag = EXCLUDED.flag, is_active = EXCLUDED.is_active, retell_ratio = EXCLUDED.retell_ratio;

INSERT INTO public.news_countries (id, name, code, flag, is_active, retell_ratio, created_at, updated_at)
VALUES ('d5db2e45-9d9c-4593-a0ee-8ba6c1f44b11', 'Україна', 'UA', '🇺🇦', true, 50, '2026-01-26T13:41:34.791787+00:00', '2026-02-09T10:30:11.385699+00:00')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, flag = EXCLUDED.flag, is_active = EXCLUDED.is_active, retell_ratio = EXCLUDED.retell_ratio;

-- 2. Migrate RSS Feeds
INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('e89a2942-5c5d-43cf-861f-0d73f6998dfb', '816cd62f-df7a-451e-8356-879dffd97d16', 'BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'world', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:16.526605+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('2af6f826-a993-4b28-bf9c-5e3f8057d760', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'TechCrunch', 'https://techcrunch.com/feed/', 'technology', true, 1, '2026-01-29T19:12:03.419249+00:00', '2026-02-16T00:00:16.713883+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('4ed2f4e5-4619-424e-bd21-5514e8ace9fd', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'CBS News', 'https://www.cbsnews.com/latest/rss/main', 'general', true, 1, '2026-01-26T14:27:56.133046+00:00', '2026-02-16T00:00:17.177724+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('a9e8c5c7-db6d-4167-8a47-a847d9367e54', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'ABC News: Technology', 'https://abcnews.go.com/abcnews/technologyheadlines', 'technology', true, 1, '2026-01-26T14:31:31.505022+00:00', '2026-02-16T00:00:17.513912+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('bba757b3-3fe8-417c-bbb2-3c23c4924028', 'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11', ' Kyiv Independent Feed', 'https://kyivindependent.com/news-archive/rss/', 'general', true, 1, '2026-01-26T15:37:18.627452+00:00', '2026-02-16T00:00:17.728128+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('aef5589b-8e77-4978-acda-aaa6bc7b67a3', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', ' ESPN » NFL ', 'https://www.espn.com/espn/rss/nfl/news?null', 'sports', true, 1, '2026-01-29T19:17:41.746217+00:00', '2026-02-16T00:00:17.939964+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('e7b184c3-8727-4a1a-8cda-98acacafbc8b', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'OpenAI News', 'https://openai.com/news/rss.xml', 'technology', true, 1, '2026-01-27T12:48:54.193694+00:00', '2026-02-16T00:00:19.016864+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('9dfac7db-f4ea-4490-acb1-654ac9d64be0', '816cd62f-df7a-451e-8356-879dffd97d16', 'BBC Technology', 'https://feeds.bbci.co.uk/news/technology/rss.xml', 'technology', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:19.186267+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('d5e07680-8beb-4dc3-9bf7-3f28a6441d0b', '6a1d4330-24c0-44e7-b486-5cfaa969d6b2', 'Polsat News - Wiadomości - Polska', 'https://www.polsatnews.pl/rss/polska.xml', 'general', true, 1, '2026-01-26T14:32:49.623919+00:00', '2026-02-16T00:00:19.684743+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('2a8d3762-6a20-48af-8efa-97b9eb37a816', '816cd62f-df7a-451e-8356-879dffd97d16', 'BBC UK', 'https://feeds.bbci.co.uk/news/uk/rss.xml', 'politics', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:19.831803+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('d7446266-1ec0-4686-b1b8-0254d2bd871d', 'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11', 'News - Radio Free Europe', 'https://www.rferl.org/api/zbqiml-vomx-tpeqkmy', 'general', true, 1, '2026-01-26T15:36:08.380146+00:00', '2026-02-16T00:00:20.16842+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('f23c39c1-a3ac-426d-b23e-918c525f77bf', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'NBC News Feed', 'https://feeds.nbcnews.com/nbcnews/public/news', 'general', true, 1, '2026-01-29T11:11:52.093905+00:00', '2026-02-16T00:00:20.431383+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('9b9676ca-6f1b-4cb5-a678-ecedcfb5fbb0', '816cd62f-df7a-451e-8356-879dffd97d16', 'The Guardian World', 'https://www.theguardian.com/world/rss', 'world', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:20.647706+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('413c672c-07a9-49aa-afe0-b72dda4c35f4', '6a1d4330-24c0-44e7-b486-5cfaa969d6b2', 'Polsat News - Wiadomości - Biznes', 'https://www.polsatnews.pl/rss/biznes.xml', 'economy', true, 1, '2026-01-26T14:33:51.247251+00:00', '2026-02-16T00:00:20.899184+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('73a86842-65bb-48ae-9b9a-2ba7dc1ba774', 'f07acf0c-d33c-464c-a208-a456205e012f', 'NDTV News- Special', 'https://feeds.feedburner.com/ndtvnews-trending-news', 'general', true, 1, '2026-01-29T19:39:03.006266+00:00', '2026-02-16T00:00:21.599871+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('3795559a-1cc7-4f34-858a-41b38e3bab31', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'FOX Sports', 'https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i&size=30', 'sports', true, 1, '2026-01-29T19:13:27.372357+00:00', '2026-02-16T00:00:22.008261+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('33921cea-7021-4b2e-b709-f92053d5f0b4', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'CBS Politics', 'https://www.cbsnews.com/latest/rss/politics', 'politics', true, 1, '2026-01-26T14:29:20.875321+00:00', '2026-02-16T00:00:22.134138+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('160f3305-eddb-4f68-947b-f7f4b608a4a1', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'Investing.com', 'https://www.investing.com/rss/news.rss', 'economy', true, 3, '2026-01-29T19:19:21.52986+00:00', '2026-02-16T00:00:22.579288+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('1a05f0c4-ef75-49ae-a5f8-784d72e9f2cf', 'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11', ' The New York Times » Ukraine RSS Feed', 'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/topic/destination/ukraine/rss.xml', 'general', true, 1, '2026-01-26T15:39:03.456901+00:00', '2026-02-16T00:00:22.682479+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('73626b11-bc42-4f3e-a8b7-0f9cc27ab517', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'abc news', 'https://abcnews.go.com/abcnews/moneyheadlines', 'politics', true, 1, '2026-01-26T14:30:47.055653+00:00', '2026-02-16T00:00:22.897472+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('a6690452-9ec8-4240-ba22-8df977b6a7b3', 'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11', 'Ukraine - Voice of America ', 'https://www.voanews.com/api/zt_rqyl-vomx-tpekboq_', 'world', true, 1, '2026-01-29T11:27:12.384444+00:00', '2026-02-16T00:00:23.114544+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('b910178f-56f2-4ad9-99a0-d60c46f0c250', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'general', true, 1, '2026-01-29T11:44:35.615934+00:00', '2026-02-16T00:00:24.318685+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('1af2af29-282e-46b5-aa1c-40ecd8f383ed', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'Air Force Link News ', 'https://www.spaceforce.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1&isdashboardselected=0&max=20', 'world', true, 1, '2026-01-29T11:30:14.64743+00:00', '2026-02-16T00:00:24.991798+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('c57523ab-5ff4-48bd-bb60-dea499fd3b55', 'f07acf0c-d33c-464c-a208-a456205e012f', 'The Times of India', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'general', true, 3, '2026-01-29T19:39:42.835713+00:00', '2026-02-16T00:00:25.595443+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('b9a24643-49e7-4d41-8fd7-3962366d3452', 'f07acf0c-d33c-464c-a208-a456205e012f', 'cricket', 'https://www.news18.com/commonfeeds/v1/eng/rss/cricket.xml', 'sports', true, 2, '2026-01-26T13:59:32.992029+00:00', '2026-02-16T00:00:26.703662+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('88c16ba6-2103-4d67-8394-9d5a6c63e30f', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'ArXiv ', 'https://export.arxiv.org/rss/cs.AI', 'technology', true, 1, '2026-01-27T12:55:56.258753+00:00', '2026-02-16T00:00:13.489013+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('42338d0a-5ddf-4557-93cc-94c265f9df1c', 'f07acf0c-d33c-464c-a208-a456205e012f', 'Education-career', 'https://www.news18.com/commonfeeds/v1/eng/rss/education-career.xml', 'general', true, 1, '2026-01-26T13:59:01.182137+00:00', '2026-02-16T00:00:14.274243+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('40cf70e8-93f3-4979-b7f4-553bb1fffff1', 'f07acf0c-d33c-464c-a208-a456205e012f', 'Live Cricket Scores, Cricket News | The Hinduhttps', 'https://www.thehindu.com/sport/cricket/feeder/default.rss', 'sports', true, 1, '2026-01-29T11:33:19.479208+00:00', '2026-02-16T00:00:14.968246+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('5e363c04-f3c0-4319-b5b7-4b19c3012863', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'MovieWeb - Movie and TV Reviews', 'https://movieweb.com/feed/movie-reviews/', 'culture', true, 1, '2026-01-29T11:36:40.157619+00:00', '2026-02-16T00:00:15.463025+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('e5f2e9fe-503d-49bc-8997-3a12d7759c03', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'Public and Private Laws - New items on GovInfo', 'https://www.govinfo.gov/rss/plaw.xml', 'economy', true, 1, '2026-01-26T18:04:19.725424+00:00', '2026-02-16T00:00:15.816579+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('0c38a34a-cbb7-4a9e-88d1-66b5d1c2fd35', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'ABC News: Sports', 'https://abcnews.go.com/abcnews/sportsheadlines', 'sports', true, 1, '2026-01-26T14:46:19.097555+00:00', '2026-02-16T00:00:16.352369+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('6259384f-07fc-46c1-9a32-ff67e42070ba', 'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11', 'Priamyi ', 'https://prm.ua/feed/', 'general', true, 1, '2026-02-08T19:32:35.14921+00:00', '2026-02-16T00:00:18.825001+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('ac58cfd1-cd79-4428-b9da-b5d13cd6d728', '6a1d4330-24c0-44e7-b486-5cfaa969d6b2', 'Wyborcza.pl Feed', 'https://wyborcza.pl/pub/rss/najnowsze_wyborcza.xml', 'general', true, 1, '2026-01-26T14:34:48.014668+00:00', '2026-02-16T00:00:23.380688+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('41f26d09-f623-4223-910a-4857629bccc4', '816cd62f-df7a-451e-8356-879dffd97d16', 'The Guardian Business', 'https://www.theguardian.com/uk/business/rss', 'business', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:26.811039+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('1aa65569-7424-42dc-9dab-c773b69fdc31', '816cd62f-df7a-451e-8356-879dffd97d16', 'Reuters UK', 'https://www.reutersagency.com/feed/?taxonomy=best-regions&post_type=best&best-regions=europe', 'world', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:27.592148+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('44b6e751-f7d4-4fb1-b150-81ed51c8a02b', 'f07acf0c-d33c-464c-a208-a456205e012f', 'ndia Latest News: Top National Headlines Today & Breaking News | The Hinduhttps', 'https://www.thehindu.com/news/national/feeder/default.rss', 'general', true, 3, '2026-01-29T11:32:13.616404+00:00', '2026-02-16T00:00:30.154381+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('91d5d425-b171-445b-9904-25f2367c9a16', '816cd62f-df7a-451e-8356-879dffd97d16', 'Sky News', 'https://feeds.skynews.com/feeds/rss/home.xml', 'general', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:30.477023+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('102df980-2cae-4695-acaf-d0aaa3c85e0a', '816cd62f-df7a-451e-8356-879dffd97d16', 'BBC News', 'https://feeds.bbci.co.uk/news/rss.xml', 'general', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:30.750147+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('53fa4c25-8fb0-4b15-9ba6-373107c2bfce', 'd5db2e45-9d9c-4593-a0ee-8ba6c1f44b11', 'Russia Invades Ukraine - Radio Free Europe / Radio Liberty ', 'https://www.rferl.org/api/zbgvmtl-vomx-tpeq_kmr', 'general', true, 1, '2026-01-26T15:35:22.154918+00:00', '2026-02-16T00:00:30.924631+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('62cf4d25-7ddc-4e78-9666-9df970459f67', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'PBS News', 'https://www.pbs.org/newshour/feeds/rss/headlines', 'world', true, 1, '2026-02-09T18:41:49.474144+00:00', '2026-02-16T00:00:31.171659+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('d03b4fc4-7d8c-4a52-a1cf-5e5b01df02df', '816cd62f-df7a-451e-8356-879dffd97d16', 'The Guardian UK', 'https://www.theguardian.com/uk/rss', 'politics', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:31.659911+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('d6cc6c90-5ba2-4338-9ab1-a4b020654b0c', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'Arts & Culture - Voice of America', 'https://www.voanews.com/api/zpbovl-vomx-tpe_vmr', 'culture', true, 1, '2026-01-29T11:26:24.363142+00:00', '2026-02-16T00:00:31.835147+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('88116b33-6054-4f2d-83ec-5d809eb6f337', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'MIT Technology Review ', 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', 'technology', true, 1, '2026-01-27T12:51:00.233997+00:00', '2026-02-16T00:00:32.022046+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('ae4f198b-f2c3-4cef-86f6-68c5d78e74fa', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'U.S. Department of State ', 'https://www.state.gov/rss-feed/press-releases/feed/', 'general', true, 1, '2026-01-26T14:26:16.904121+00:00', '2026-02-16T00:00:32.275231+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('78026c20-0f9d-4a96-9e80-226feff1e043', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'Department of War News Feed ', 'https://www.war.gov/DesktopModules/ArticleCS/RSS.ashx?max=10&ContentType=1&Site=945', 'world', true, 1, '2026-01-29T11:14:51.239214+00:00', '2026-02-16T00:00:32.436503+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('339ef4f5-f683-4754-b510-a8e8641fa543', '816cd62f-df7a-451e-8356-879dffd97d16', 'BBC Business', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'business', true, 5, '2026-02-09T10:26:26.470637+00:00', '2026-02-16T00:00:32.592648+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

INSERT INTO public.news_rss_feeds (id, country_id, name, url, category, is_active, sample_ratio, created_at, updated_at)
VALUES ('9541c9eb-afc1-46c5-a7c3-153070391863', '1f57c11e-ab27-4e4e-b289-ca31dc80e895', 'Los Angeles Times', 'https://www.latimes.com/opinion.rss', 'general', true, 1, '2026-02-09T18:49:42.951051+00:00', '2026-02-16T00:00:33.45626+00:00')
ON CONFLICT (id) DO UPDATE SET country_id = EXCLUDED.country_id, name = EXCLUDED.name, url = EXCLUDED.url, category = EXCLUDED.category, is_active = EXCLUDED.is_active;

