import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, CloudRain, DollarSign, AlertTriangle, Settings, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import './dashboard.css';
import './brand.css';
import LogoHeader from './components/LogoHeader.jsx';
import AIAdvisor from './components/AIAdvisor.jsx';
import CarbonCreditCalculator from './components/CarbonCreditCalculator.jsx';

const PlantProfitDashboard = () => {
  const [apiKey, setApiKey] = useState('');
  const [county, setCounty] = useState('FRESNO');
  const [stateAlpha, setStateAlpha] = useState('CA');
  const [commodity, setCommodity] = useState('COTTON');
  const [isLoading, setIsLoading] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [cropData, setCropData] = useState(null);
  const [priceScenario, setPriceScenario] = useState(0);
  const [costScenario, setCostScenario] = useState(0);
  const [rainfallScenario, setRainfallScenario] = useState(0);
  const [error, setError] = useState('📊 Showing sample crop data. Enter your USDA API key (optional) to load live county data.');
  const [cropMode, setCropMode] = useState('annual');

  const FRESNO_LAT = 36.7378;
  const FRESNO_LON = -119.7871;

  const annualCropData = {
    tomatoes: {
      name: 'Processing Tomatoes',
      type: 'annual',
      avgYield: 45,
      avgPrice: 95,
      costs: 3200,
      priceVolatility: 0.15,
      yieldHistory: [42, 44, 43, 46, 45, 47, 45],
      priceHistory: [88, 92, 90, 94, 95, 93, 95],
      description: 'Annual crop - plant & harvest same year'
    },
    cotton: {
      name: 'Cotton',
      type: 'annual',
      avgYield: 1400,
      avgPrice: 0.75,
      costs: 1200,
      priceVolatility: 0.20,
      yieldHistory: [1300, 1350, 1380, 1420, 1400, 1450, 1400],
      priceHistory: [0.68, 0.72, 0.71, 0.74, 0.75, 0.73, 0.75],
      description: 'Annual crop - plant & harvest same year'
    },
    corn: {
      name: 'Corn',
      type: 'annual',
      avgYield: 180,
      avgPrice: 5.50,
      costs: 950,
      priceVolatility: 0.18,
      yieldHistory: [170, 175, 178, 182, 180, 185, 180],
      priceHistory: [5.20, 5.40, 5.35, 5.45, 5.50, 5.48, 5.50],
      description: 'Annual crop - plant & harvest same year'
    }
  };

  const perennialCropData = {
    almonds: {
      name: 'Almonds',
      type: 'perennial',
      avgYield: 2400,
      avgPrice: 2.80,
      costs: 4200,
      establishmentCost: 12000,
      yearsToProduction: 3,
      priceVolatility: 0.25,
      yieldHistory: [2200, 2300, 2350, 2400, 2380, 2450, 2400],
      priceHistory: [2.40, 2.60, 2.70, 2.75, 2.80, 2.85, 2.80],
      description: 'Perennial orchard - 20-25 year lifespan, 3 years to production'
    },
    grapes: {
      name: 'Wine Grapes',
      type: 'perennial',
      avgYield: 6,
      avgPrice: 850,
      costs: 3500,
      establishmentCost: 15000,
      yearsToProduction: 3,
      priceVolatility: 0.20,
      yieldHistory: [5.5, 5.8, 5.9, 6.0, 6.1, 6.2, 6.0],
      priceHistory: [800, 820, 830, 840, 850, 860, 850],
      description: 'Perennial vineyard - 25-30 year lifespan, 3 years to production'
    },
    pistachios: {
      name: 'Pistachios',
      type: 'perennial',
      avgYield: 2000,
      avgPrice: 3.50,
      costs: 3800,
      establishmentCost: 10000,
      yearsToProduction: 5,
      priceVolatility: 0.22,
      yieldHistory: [1800, 1900, 1950, 2000, 2050, 2100, 2000],
      priceHistory: [3.20, 3.30, 3.35, 3.45, 3.50, 3.55, 3.50],
      description: 'Perennial orchard - 40-50 year lifespan, 5 years to production'
    }
  };

  const fetchWeatherData = async () => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${FRESNO_LAT}&longitude=${FRESNO_LON}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&past_days=90&forecast_days=14&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America/Los_Angeles`
      );
      const data = await response.json();
      
      const recentPrecip = data.daily.precipitation_sum.slice(-90).reduce((a, b) => a + b, 0);
      const normalPrecip = 2.5;
      const rainfallAnomaly = ((recentPrecip - normalPrecip) / normalPrecip) * 100;
      
      setWeatherData({
        recentPrecip: recentPrecip.toFixed(2),
        rainfallAnomaly: rainfallAnomaly.toFixed(1),
        avgTemp: (data.daily.temperature_2m_max.slice(-30).reduce((a, b) => a + b, 0) / 30).toFixed(1),
        forecast: data.daily.precipitation_sum.slice(-14).map((precip, i) => ({
          day: i + 1,
          precipitation: precip
        }))
      });
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Could not fetch weather data');
    }
  };

  const fetchUSDAData = async () => {
    if (!apiKey) {
      setError('Please enter your USDA NASS API key');
      return;
    }
    try {
      // Dynamic query for any county/state/commodity
  const url = `/api/usda?key=${apiKey}&county_name=${encodeURIComponent(county)}&state_alpha=${encodeURIComponent(stateAlpha)}&commodity_desc=${encodeURIComponent(commodity)}&statisticcat_desc=YIELD&agg_level_desc=COUNTY&year__GE=2018&format=JSON`;
      console.log('Fetching from:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('API Response:', data);

      if (data.error) {
        setError('USDA API Error: ' + JSON.stringify(data.error));
        setCropData(cropMode === 'annual' ? annualCropData : perennialCropData);
        return;
      }

      if (data.data && data.data.length > 0) {
        const yields = data.data
          .filter(d => d.Value && d.Value !== ' ' && !isNaN(parseFloat(d.Value.replace(/,/g, ''))))
          .map(d => ({
            year: parseInt(d.year),
            value: parseFloat(d.Value.replace(/,/g, ''))
          }))
          .sort((a, b) => a.year - b.year);

        console.log('Processed yields:', yields);

        if (yields.length > 0) {
            // The USDA query here is specific to cotton (an annual). Only apply
            // the live cotton update when the UI is in 'annual' crop mode.
            if (cropMode === 'annual') {
              const updatedCropData = { ...annualCropData };
              updatedCropData.cotton.yieldHistory = yields.map(y => y.value);
              updatedCropData.cotton.avgYield = yields[yields.length - 1].value;
              setCropData(updatedCropData);
              setError(`✅ Loaded live ${commodity} data for ${county} County, ${stateAlpha} (${yields.length} years)`);
            } else {
              // If the user is viewing perennials, don't overwrite with annual data.
              setCropData(perennialCropData);
              setError(`⚠️ USDA returned ${commodity} data (${yields.length} years). Showing perennial sample data instead.`);
            }
        } else {
          setCropData(cropMode === 'annual' ? annualCropData : perennialCropData);
          setError('No valid yield values found in API response');
        }
      } else {
        setCropData(cropMode === 'annual' ? annualCropData : perennialCropData);
        setError('Using sample data - API returned no results for Fresno County');
      }
    } catch (err) {
      console.error('USDA fetch error:', err);
      setError('⚠️ Unable to connect to USDA API - using sample data. This is normal if the backend is not running or the API key is invalid.');
      setCropData(cropMode === 'annual' ? annualCropData : perennialCropData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
    setCropData(cropMode === 'annual' ? annualCropData : perennialCropData);
    if (apiKey) {
      fetchUSDAData();
    }
  }, [cropMode]);

  const calculateProfit = (crop) => {
    if (!crop || !weatherData) return null;

    const rainfallFactor = 1 + (rainfallScenario / 100) * 0.3;
    const weatherFactor = weatherData.rainfallAnomaly ? 1 + (parseFloat(weatherData.rainfallAnomaly) / 100) * 0.2 : 1;
    const adjustedYield = crop.avgYield * rainfallFactor * weatherFactor;

    const adjustedPrice = crop.avgPrice * (1 + priceScenario / 100);
    const adjustedCosts = crop.costs * (1 + costScenario / 100);

    const revenue = adjustedYield * adjustedPrice;
    const profit = revenue - adjustedCosts;

    let roi = null;
    let breakEven = null;
    if (crop.type === 'perennial') {
      roi = (profit / crop.establishmentCost * 100).toFixed(1);
      breakEven = (crop.establishmentCost / profit).toFixed(1);
    }

    const riskScore = Math.min(100, (crop.priceVolatility * 100 + Math.abs(rainfallScenario) / 2));

    return {
      revenue: revenue.toFixed(0),
      profit: profit.toFixed(0),
      yield: adjustedYield.toFixed(0),
      price: adjustedPrice.toFixed(2),
      costs: adjustedCosts.toFixed(0),
      riskScore: riskScore.toFixed(0),
      roi,
      breakEven
    };
  };

  const getRankedCrops = () => {
    if (!cropData || !weatherData) return [];
    
    const crops = Object.entries(cropData).map(([key, crop]) => {
      const metrics = calculateProfit(crop);
      return {
        key,
        ...crop,
        metrics: metrics || {
          revenue: '0',
          profit: '0',
          yield: '0',
          price: '0',
          costs: '0',
          riskScore: '0',
          roi: null,
          breakEven: null
        }
      };
    });

    return crops
      .filter(c => c.metrics && c.metrics.profit)
      .sort((a, b) => 
        parseFloat(b.metrics.profit) - parseFloat(a.metrics.profit)
      );
  };

  const rankedCrops = getRankedCrops();

  const downloadReport = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const title = 'PlantProfit Advisory Report';
    doc.setFontSize(18);
    doc.text(title, 40, 40);

    doc.setFontSize(12);
    doc.text(`Region: Fresno County, CA`, 40, 70);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 40, 86);

    if (weatherData) {
      doc.setFontSize(13);
      doc.text('Weather Snapshot', 40, 120);
      doc.setFontSize(11);
      doc.text(`Last 90 Days Rainfall: ${weatherData.recentPrecip}"`, 60, 138);
      doc.text(`Rainfall Anomaly: ${weatherData.rainfallAnomaly}%`, 60, 154);
      doc.text(`Avg Temp (30d): ${weatherData.avgTemp}°F`, 60, 170);
    }

    if (rankedCrops && rankedCrops.length > 0) {
      const top = rankedCrops[0];
      doc.setFontSize(13);
      doc.text('Top Recommendation', 40, 200);
      doc.setFontSize(11);
      doc.text(`${top.name} (${top.type})`, 60, 218);
      doc.text(`Expected Profit/Acre: $${parseFloat(top.metrics.profit).toLocaleString()}`, 60, 234);
      doc.text(`Yield: ${top.metrics.yield}`, 60, 250);
      doc.text(`Price: $${top.metrics.price}`, 60, 266);
      if (top.type === 'perennial') {
        doc.text(`Establishment Cost: $${top.establishmentCost.toLocaleString()}`, 60, 282);
        doc.text(`Years to Production: ${top.yearsToProduction}`, 60, 298);
      }
    }

    doc.setFontSize(10);
    doc.text('Generated by PlantProfit', 40, 740);
    doc.save('plantprofit-advisory-report.pdf');
  };

  const setModeAndData = (mode) => {
    setCropMode(mode);
    setCropData(mode === 'annual' ? annualCropData : perennialCropData);
  };

  return (
    <>
      <LogoHeader />
      <div className="app-root">
        <div className="container">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div />
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Current Season Outlook</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>2025 Spring</div>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #eef2f7' }}>
            <div className="segmented">
              <button onClick={() => setModeAndData('annual')} className={cropMode === 'annual' ? 'active' : ''}>
                <div>Annual Crops</div>
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>Tomatoes, Cotton, Corn • Plant next season</div>
              </button>
              <button onClick={() => setModeAndData('perennial')} className={cropMode === 'perennial' ? 'active' : ''}>
                <div>Perennial Crops</div>
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>Almonds, Grapes, Pistachios • Investment & price outlook</div>
              </button>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #eef2f7' }}>
            <div className="input-group">
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 6, color: 'var(--muted)', fontSize: 13 }}>
                  USDA NASS API Key (optional - loads live county data)
                </label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter your API key..." />
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, marginRight: 8 }}>County:</label>
                <input type="text" value={county} onChange={e => setCounty(e.target.value)} style={{ marginRight: 12 }} />
                <label style={{ fontSize: 13, marginRight: 8 }}>State:</label>
                <input type="text" value={stateAlpha} onChange={e => setStateAlpha(e.target.value)} style={{ width: 40, marginRight: 12 }} />
                <label style={{ fontSize: 13, marginRight: 8 }}>Commodity:</label>
                <input type="text" value={commodity} onChange={e => setCommodity(e.target.value)} style={{ marginRight: 12 }} />
              </div>
              <button onClick={fetchUSDAData} disabled={isLoading || !apiKey} className="btn-primary">
                {isLoading ? 'Loading...' : 'Load Live Data'}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 8, fontSize: 13, padding: '8px 12px', borderRadius: 10, background: error.includes('\u2705') ? '#ecfdf5' : '#fff7ed', color: error.includes('\u2705') ? '#065f46' : '#92400e' }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* AI Advisor onboarding & chat */}
        <div style={{ marginTop: 16 }}>
          <AIAdvisor />
        </div>
        
        {/* Carbon Credit Calculator */}
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign className="text-green-500" /> Carbon Credit Calculator
          </h2>
          <CarbonCreditCalculator />
        </div>

        {weatherData && (
          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CloudRain className="text-blue-500" /> Current Weather Conditions
            </h2>
            <div className="small-grid-3">
              <div className="metric">
                <div className="label">Last 90 Days Rainfall</div>
                <div className="value" style={{ color: 'var(--accent-2)' }}>{weatherData.recentPrecip}"</div>
              </div>
              <div className="metric">
                <div className="label">Rainfall Anomaly</div>
                <div className="value" style={{ color: parseFloat(weatherData.rainfallAnomaly) > 0 ? 'var(--accent)' : '#d97706' }}>{weatherData.rainfallAnomaly}%</div>
              </div>
              <div className="metric">
                <div className="label">Avg Temperature (30d)</div>
                <div className="value">{weatherData.avgTemp}°F</div>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings className="text-gray-600" /> Scenario Planning
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--muted)' }}>Price Change: {priceScenario > 0 ? '+' : ''}{priceScenario}%</label>
              <input type="range" min="-30" max="30" value={priceScenario} onChange={(e) => setPriceScenario(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--muted)' }}>Input Cost Change: {costScenario > 0 ? '+' : ''}{costScenario}%</label>
              <input type="range" min="-20" max="40" value={costScenario} onChange={(e) => setCostScenario(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--muted)' }}>Rainfall Change: {rainfallScenario > 0 ? '+' : ''}{rainfallScenario}%</label>
              <input type="range" min="-40" max="40" value={rainfallScenario} onChange={(e) => setRainfallScenario(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{cropMode === 'annual' ? 'What to Plant Next Season' : 'Orchard Investment & Revenue Outlook'}</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>{cropMode === 'annual' ? 'Annual crops - replanted each season. Choose based on expected profit for 2025 harvest.' : 'Perennial orchards - multi-year investment. Focus on long-term ROI and current price outlook.'}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {rankedCrops.map((crop, index) => (
              <div key={crop.key} className="card" style={{ transition: 'box-shadow 160ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Rank #{index + 1}</div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>{crop.name}</h3>
                  </div>
                  <div className="badge" style={{ background: index === 0 ? '#ecfdf5' : index === 1 ? '#eef2ff' : '#f3f4f6', color: index === 0 ? '#065f46' : index === 1 ? '#1e40af' : '#374151' }}>{index === 0 ? 'Best Choice' : index === 1 ? 'Good' : 'Consider'}</div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 12 }}>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>{crop.type === 'annual' ? 'Expected Profit/Acre' : 'Annual Revenue/Acre'}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>${parseFloat(crop.metrics.profit).toLocaleString()}</div>
                  </div>

                  {crop.type === 'perennial' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: '#eff6ff', borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>ROI (Annual)</div>
                        <div style={{ fontWeight: 700, color: 'var(--accent-2)' }}>{crop.metrics.roi}%</div>
                      </div>
                      <div style={{ background: '#faf5ff', borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Break-even</div>
                        <div style={{ fontWeight: 700, color: '#6b21a8' }}>{crop.metrics.breakEven} yrs</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 8 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Yield</div>
                      <div style={{ fontWeight: 700 }}>{crop.metrics.yield}</div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 8 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Price</div>
                      <div style={{ fontWeight: 700 }}>${crop.metrics.price}</div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 8 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Revenue</div>
                      <div style={{ fontWeight: 700 }}>${parseFloat(crop.metrics.revenue).toLocaleString()}</div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 8 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>Annual Costs</div>
                      <div style={{ fontWeight: 700 }}>${parseFloat(crop.metrics.costs).toLocaleString()}</div>
                    </div>
                  </div>

                  {crop.type === 'perennial' && (
                    <div style={{ background: '#fff7ed', borderRadius: 8, padding: 10, fontSize: 13 }}>
                      <div style={{ fontWeight: 700, color: '#92400e' }}>Establishment: ${crop.establishmentCost.toLocaleString()}</div>
                      <div style={{ color: '#92400e' }}>{crop.yearsToProduction} years to first production</div>
                    </div>
                  )}

                  <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>{crop.description}</div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: 'var(--muted)' }}>Risk Score</span>
                      <span style={{ fontWeight: 700 }}>{crop.metrics.riskScore}/100</span>
                    </div>
                    <div className="risk-bar">
                      <i style={{ width: `${crop.metrics.riskScore}%`, background: crop.metrics.riskScore < 30 ? '#16a34a' : crop.metrics.riskScore < 60 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {rankedCrops[0] && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{rankedCrops[0].name} - Yield History</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={rankedCrops[0].yieldHistory.map((y, i) => ({ year: 2018 + i, yield: y }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="yield" stroke="#16a34a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{rankedCrops[0].name} - Price History</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={rankedCrops[0].priceHistory.map((p, i) => ({ year: 2018 + i, price: p }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Download Advisory Report</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Share with lenders, cooperatives, or partners</p>
            </div>
            <button onClick={downloadReport} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={18} />
              Download PDF Report
            </button>
          </div>
        </div>

        <div className="footer-note">Data sources: USDA NASS (county yields) • Open-Meteo (weather) • Live updated {new Date().toLocaleDateString()}</div>
      </div>
    </div>
    </>
  );
};

export default PlantProfitDashboard;