import React from 'react';
import logo from '../assets/newlogo.jpg';

const LogoHeader = () => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '18px 0 12px 24px', background: 'white', position: 'relative', zIndex: 10 }}>
    <img src={logo} alt="FieldFolio Logo" style={{ width: 48, height: 48, marginRight: 14, borderRadius: 8 }} />
    <span style={{ fontFamily: 'Inter, Helvetica Neue, Arial, sans-serif', fontWeight: 900, fontSize: 30, color: '#23412a', letterSpacing: '-1px', textTransform: 'uppercase' }}>FieldFolio</span>
  </div>
);

export default LogoHeader;
