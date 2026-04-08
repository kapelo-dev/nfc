function subdomainMiddleware(req, res, next) {
  const host = req.get('host');
  const baseDomain = process.env.BASE_DOMAIN || 'localhost:3000';
  
  if (host && host !== baseDomain) {
    const subdomain = host.split('.')[0];
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'admin') {
      req.subdomain = subdomain;
    }
  }
  
  next();
}

module.exports = { subdomainMiddleware };
