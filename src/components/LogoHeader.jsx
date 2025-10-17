import React from 'react';
import logo from '../assets/fieldfolio-logo.png';

const LogoHeader = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '32px 0 24px 0' }}>
    <img src={logo} alt="FieldFolio Logo" style={{ width: 120, height: 120, marginBottom: 12 }} />
    <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 36, color: '#23412a', letterSpacing: -1, margin: 0 }}>FieldFolio</h1>
  </div>
);

export default LogoHeader;
