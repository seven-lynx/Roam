-- Add National Geographic to the paywalled domains list
INSERT INTO paywalled_domains (domain) VALUES
  ('nationalgeographic.com')
ON CONFLICT (domain) DO NOTHING;
