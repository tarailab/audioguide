const router = require('express').Router();
const trips = require('../services/trips');

// Single-user for now: identity comes from the x-user-id header, defaulting to
// 'local'. When auth lands, swap this for the authenticated user — the store
// already scopes by owner/members.
function userId(req) {
  return req.get('x-user-id') || 'local';
}

router.get('/', (req, res) => {
  res.json({ trips: trips.list(userId(req)) });
});

router.post('/', (req, res) => {
  const trip = trips.create(req.body?.name, userId(req));
  res.status(201).json({ trip });
});

router.get('/:id', (req, res) => {
  const trip = trips.get(req.params.id, userId(req));
  if (!trip) return res.status(404).json({ error: 'trip not found' });
  res.json({ trip });
});

router.patch('/:id', (req, res) => {
  const trip = trips.rename(req.params.id, req.body?.name, userId(req));
  if (!trip) return res.status(404).json({ error: 'trip not found' });
  res.json({ trip });
});

router.delete('/:id', (req, res) => {
  const ok = trips.remove(req.params.id, userId(req));
  if (!ok) return res.status(404).json({ error: 'trip not found' });
  res.status(204).end();
});

// Add / upsert a POI. Body: { poi: {id,name,lat,lon,tags,tier,image,wiki}, status, note }
router.post('/:id/items', (req, res) => {
  const { poi, status, note } = req.body || {};
  if (!poi || !poi.id) return res.status(400).json({ error: 'poi {id} required' });
  const result = trips.setItem(req.params.id, poi, { status, note }, userId(req));
  if (!result) return res.status(404).json({ error: 'trip not found' });
  if (result.error) return res.status(400).json(result);
  res.json({ trip: result });
});

router.patch('/:id/items/:poiId', (req, res) => {
  const result = trips.updateItem(req.params.id, req.params.poiId, req.body || {}, userId(req));
  if (!result) return res.status(404).json({ error: 'trip not found' });
  if (result.error) return res.status(result.error === 'item not found' ? 404 : 400).json(result);
  res.json({ trip: result });
});

router.delete('/:id/items/:poiId', (req, res) => {
  const result = trips.removeItem(req.params.id, req.params.poiId, userId(req));
  if (!result) return res.status(404).json({ error: 'trip not found' });
  if (result.error) return res.status(404).json(result);
  res.json({ trip: result });
});

module.exports = router;
