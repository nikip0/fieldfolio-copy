import React from 'react';
import logo from '../assets/newlogo.jpg';

const LogoHeader = () => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '18px 0 12px 24px', background: 'var(--header-bg)', position: 'relative', zIndex: 10, borderBottom: '1px solid var(--border-color, #e5e7eb)' }}>
    <img src={logo} alt="FieldFolio Logo" style={{ width: 48, height: 48, marginRight: 14, borderRadius: 8 }} />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif', fontWeight: 900, fontSize: 30, color: 'var(--header-text)', letterSpacing: '-1px' }}>FieldFolio</span>
      <span style={{ fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif', fontWeight: 400, fontSize: 14, color: 'var(--header-tagline)', letterSpacing: '0.5px', marginTop: '2px' }}>Where Agriculture Meets Algorithm</span>
    </div>
  </div>
);

export default LogoHeader;
