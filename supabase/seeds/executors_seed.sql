-- Seed data for Executors
INSERT INTO executors (name, slug, description, long_description, download_url, image_url, price_brl, is_free, platform, supported_games, is_featured, status, security_status, safety_level, detection_status, is_recommended, version, key_system, official_site, discord_url, tutorial_url, trust_score, developer, execution_method, requirements, features, badges) VALUES
('Xeno', 'xeno', 'Executor Windows popular com boa estabilidade.', 'Xeno é um executor Roblox para Windows conhecido pela boa performance, interface simples e boa estabilidade para scripts comuns.', '', '/images/executors/xeno.png', 0, true, '{Windows}', '{Blox Fruits,Rivals,Grow a Garden}', true, 'online', 'undetected', 'safe', 'undetected', true, '1.3.25', false, '', '', '/tutorials/xeno', 91, 'Xeno Team', 'External', 'Windows 10/11 64-bit', '{Auto Execute,Script Hub,Fast Inject}', '{Recomendado,Mais Seguro}'),

('Delta', 'delta', 'Um dos melhores executores Android.', 'Delta é extremamente popular entre usuários mobile por sua estabilidade e suporte amplo.', '', '/images/executors/delta.png', 0, true, '{Android}', '{Blox Fruits,Pet Sim,MM2}', true, 'online', 'undetected', 'safe', 'undetected', true, '2.708', true, '', '', '/tutorials/delta', 87, 'Delta Team', 'Mobile Inject', 'Android 8+', '{Script Hub,Fast Execute,UI Mobile}', '{Melhor Android,Recomendado}'),

('Codex', 'codex', 'Executor Android/iOS moderno.', 'Codex oferece bom desempenho em dispositivos mobile com suporte crescente.', '', '/images/executors/codex.png', 0, true, '{Android,iOS}', '{Blox Fruits,Rivals}', true, 'online', 'undetected', 'safe', 'undetected', true, '2.693', true, '', '', '/tutorials/codex', 89, 'Codex Team', 'Mobile Inject', 'Android 8+, iOS compatível', '{Mobile UI,Script Hub}', '{Popular,Recomendado}'),

('Arceus X', 'arceus-x', 'Executor mobile conhecido.', 'Arceus X foi um dos executores Android mais populares do mercado.', '', '/images/executors/arceusx.png', 0, true, '{Android}', '{Diversos}', false, 'online', 'medium_risk', 'medium', 'partial', false, 'Latest', true, '', '', '/tutorials/arceus-x', 72, 'SPDM Team', 'Mobile Inject', 'Android 8+', '{Script Hub}', '{Popular}'),

('Solara', 'solara', 'Executor Windows rápido e moderno.', 'Solara é muito usado por usuários que buscam boa performance e interface limpa.', '', '/images/executors/solara.png', 0, true, '{Windows}', '{Blox Fruits,Rivals}', true, 'online', 'undetected', 'safe', 'undetected', true, 'Latest', false, '', '', '/tutorials/solara', 90, 'Solara Team', 'External', 'Windows 10/11', '{Fast Inject,Script Hub}', '{Melhor Gratuito,Popular}'),

('Wave', 'wave', 'Executor premium de alta performance.', 'Wave é um executor premium focado em estabilidade, segurança e performance.', '', '/images/executors/wave.png', 49.90, false, '{Windows}', '{Todos principais}', true, 'online', 'undetected', 'safe', 'undetected', true, 'Latest', false, '', '', '/tutorials/wave', 94, 'Wave Team', 'External', 'Windows 10/11', '{Premium Support,Fast Inject,High UNC}', '{Premium,Mais Seguro}'),

('MacSploit', 'macsploit', 'Principal executor para macOS.', 'MacSploit é uma das melhores opções para usuários Apple.', '', '/images/executors/macsploit.png', 79.90, false, '{macOS}', '{Principais games Roblox}', true, 'online', 'undetected', 'safe', 'undetected', true, '1.9.3', false, '', '', '/tutorials/macsploit', 92, 'MacSploit Team', 'Native Inject', 'macOS atualizado', '{Native Mac Support}', '{Melhor macOS}')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  long_description = EXCLUDED.long_description,
  platform = EXCLUDED.platform,
  supported_games = EXCLUDED.supported_games,
  is_featured = EXCLUDED.is_featured,
  status = EXCLUDED.status,
  security_status = EXCLUDED.security_status,
  safety_level = EXCLUDED.safety_level,
  detection_status = EXCLUDED.detection_status,
  is_recommended = EXCLUDED.is_recommended,
  version = EXCLUDED.version,
  key_system = EXCLUDED.key_system,
  trust_score = EXCLUDED.trust_score,
  developer = EXCLUDED.developer,
  execution_method = EXCLUDED.execution_method,
  requirements = EXCLUDED.requirements,
  features = EXCLUDED.features,
  badges = EXCLUDED.badges,
  is_free = EXCLUDED.is_free,
  price_brl = EXCLUDED.price_brl,
  tutorial_url = EXCLUDED.tutorial_url;
