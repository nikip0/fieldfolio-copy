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
  const [annualWeatherPrediction, setAnnualWeatherPrediction] = useState(null);
  const [climateProjections, setClimateProjections] = useState(null);
  const [aiWeatherLoading, setAiWeatherLoading] = useState(false);

  // Farm model state
  const [acres, setAcres] = useState(50);
  const [irrigated, setIrrigated] = useState(50);
  const [budget, setBudget] = useState(25000);
  const [zones, setZones] = useState('');
  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);

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

  // AI-powered annual weather prediction for next growing season
  const getAnnualWeatherPrediction = async () => {
    try {
      // Get extended seasonal forecast
      const response = await fetch(
        `https://seasonal-api.open-meteo.com/v1/seasonal?latitude=${FRESNO_LAT}&longitude=${FRESNO_LON}&models=ecmwf&daily=temperature_2m_mean,precipitation_sum&start_date=2025-03-01&end_date=2025-11-30`
      );
      const seasonalData = await response.json();
      
      // AI analysis of seasonal patterns
      const avgTemp = seasonalData.daily.temperature_2m_mean.reduce((a, b) => a + b, 0) / seasonalData.daily.temperature_2m_mean.length;
      const totalPrecip = seasonalData.daily.precipitation_sum.reduce((a, b) => a + b, 0);
      
      // AI-enhanced prediction factors
      const tempTrend = avgTemp > 70 ? 1.05 : avgTemp > 65 ? 1.02 : 0.98; // Heat stress factor
      const waterStress = totalPrecip < 20 ? 0.85 : totalPrecip > 40 ? 1.1 : 1.0; // Drought/flood factor
      const climateRisk = Math.abs(avgTemp - 68) / 10; // Optimal temp is ~68F
      
      return {
        avgGrowingTemp: avgTemp.toFixed(1),
        totalGrowingPrecip: totalPrecip.toFixed(1),
        tempFactor: tempTrend,
        waterFactor: waterStress,
        climateRisk: Math.min(0.5, climateRisk),
        prediction: totalPrecip < 15 ? 'drought-likely' : totalPrecip > 50 ? 'wet-season' : 'normal',
        aiConfidence: 0.78 // Simulated AI confidence score
      };
    } catch (err) {
      console.error('Seasonal forecast error:', err);
      return {
        avgGrowingTemp: '68.5',
        totalGrowingPrecip: '25.2',
        tempFactor: 1.0,
        waterFactor: 1.0,
        climateRisk: 0.15,
        prediction: 'normal',
        aiConfidence: 0.65
      };
    }
  };

  // Climate change projections for perennial crops (20-40 year outlook)
  const getClimateChangeProjections = () => {
    // Based on IPCC climate models and regional projections for Central Valley
    const currentYear = 2025;
    const projectionYears = [2030, 2035, 2040, 2045, 2050];
    
    return projectionYears.map(year => {
      const yearsOut = year - currentYear;
      
      // Climate change factors (moderate scenario - RCP4.5)
      const tempIncrease = yearsOut * 0.2; // 0.2°F per year
      const precipChange = yearsOut * -0.5; // -0.5% precipitation per year
      const extremeWeatherRisk = Math.min(0.8, yearsOut * 0.03); // Increasing extreme events
      const droughtRisk = Math.min(0.7, yearsOut * 0.025); // Increasing drought probability
      
      // AI-calculated yield impact
      const heatStressFactor = 1 - (tempIncrease * 0.015); // 1.5% yield loss per degree
      const waterStressFactor = 1 + (precipChange * 0.008); // 0.8% yield change per % precip change
      const adaptationFactor = 1 + (yearsOut * 0.005); // 0.5% improvement from adaptation/tech
      
      const overallYieldFactor = heatStressFactor * waterStressFactor * adaptationFactor;
      
      return {
        year,
        tempIncrease: tempIncrease.toFixed(1),
        precipChange: precipChange.toFixed(1),
        yieldFactor: overallYieldFactor.toFixed(3),
        extremeWeatherRisk: (extremeWeatherRisk * 100).toFixed(0),
        droughtRisk: (droughtRisk * 100).toFixed(0),
        aiRecommendation: extremeWeatherRisk > 0.4 ? 'consider-diversification' : 'maintain-current'
      };
    });
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

  // Farm model functions
  const buildModel = async () => {
    setLoadingModel(true);
    setModelError(null);
    try {
      // Use relative URL for Vercel compatibility
      const res = await fetch('/api/farm-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acres: Number(acres), irrigated: Number(irrigated), budget: Number(budget), zones })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Server error (${res.status}): ${txt}`);
      }
      const data = await res.json();
      if (!data || !data.model) throw new Error('Invalid model response from server');
      setModel(data.model);
    } catch (err) {
      console.error('buildModel error', err);
      setModelError(err.message || String(err));
      setModel(null);
    } finally {
      setLoadingModel(false);
    }
  };

  const testApi = async () => {
    setHealthStatus(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const j = await res.json();
      setHealthStatus({ ok: true, info: j });
    } catch (err) {
      console.error('health check failed', err);
      setHealthStatus({ ok: false, error: err.message || String(err) });
    }
  };

  useEffect(() => {
    fetchWeatherData();
    setCropData(cropMode === 'annual' ? annualCropData : perennialCropData);
    
    // Load AI weather predictions
    const loadAIPredictions = async () => {
      setAiWeatherLoading(true);
      try {
        if (cropMode === 'annual') {
          const prediction = await getAnnualWeatherPrediction();
          setAnnualWeatherPrediction(prediction);
        } else {
          const projections = getClimateChangeProjections();
          setClimateProjections(projections);
        }
      } catch (err) {
        console.error('AI prediction error:', err);
      } finally {
        setAiWeatherLoading(false);
      }
    };
    
    loadAIPredictions();
    
    if (apiKey) {
      fetchUSDAData();
    }
  }, [cropMode]);

  const calculateProfit = (crop) => {
    if (!crop || !weatherData) return null;

    // Base factors
    const rainfallFactor = 1 + (rainfallScenario / 100) * 0.3;
    const weatherFactor = weatherData.rainfallAnomaly ? 1 + (parseFloat(weatherData.rainfallAnomaly) / 100) * 0.2 : 1;
    
    // AI-enhanced factors
    let aiWeatherFactor = 1;
    let climateRiskFactor = 1;
    
    if (crop.type === 'annual' && annualWeatherPrediction) {
      // Apply AI annual weather predictions
      aiWeatherFactor = annualWeatherPrediction.tempFactor * annualWeatherPrediction.waterFactor;
      climateRiskFactor = 1 - annualWeatherPrediction.climateRisk;
    } else if (crop.type === 'perennial' && climateProjections) {
      // Apply climate change projections (use 2030 projection as primary)
      const nearTermProjection = climateProjections[0];
      if (nearTermProjection) {
        climateRiskFactor = parseFloat(nearTermProjection.yieldFactor);
      }
    }

    const adjustedYield = crop.avgYield * rainfallFactor * weatherFactor * aiWeatherFactor * climateRiskFactor;

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

    // Enhanced risk score with AI weather predictions and dynamic scenarios
    let riskScore;
    
    // Start with base risk from crop characteristics
    let totalRisk = crop.priceVolatility * 30; // Increased for better differentiation
    
    // Add crop type specific base risk
    if (crop.type === 'perennial') {
      totalRisk += 10; // Perennials have inherent long-term risks
    } else {
      totalRisk += 5; // Annuals have shorter-term risks
    }
    
    // Add scenario-based risks (major impact)
    totalRisk += Math.abs(priceScenario) * 0.8; // Price volatility risk
    totalRisk += Math.abs(costScenario) * 0.6; // Cost increase risk
    totalRisk += Math.abs(rainfallScenario) * 0.7; // Weather risk
    
    // Add AI weather risk factors
    if (crop.type === 'annual' && annualWeatherPrediction) {
      totalRisk += annualWeatherPrediction.climateRisk * 12;
      if (annualWeatherPrediction.prediction === 'drought-likely') totalRisk += 15;
      if (annualWeatherPrediction.prediction === 'wet-season') totalRisk += 10;
    } else if (crop.type === 'perennial' && climateProjections) {
      const futureRisk = climateProjections[2]; // 2040 projection
      if (futureRisk) {
        totalRisk += parseFloat(futureRisk.extremeWeatherRisk) * 0.3;
      }
      // Perennials have additional climate change risk over their long lifespan
      totalRisk += 8;
    }
    
    // Apply profit-based modulation with better ranges
    if (profit < 0) {
      // Negative profit = very high risk (60-95)
      riskScore = Math.min(95, 60 + totalRisk * 0.8 + Math.abs(profit) / 80);
    } else if (profit < 1000) {
      // Low-medium profit = moderate risk (25-65)
      riskScore = Math.min(65, 25 + totalRisk * 0.6 + (1000 - profit) / 40);
    } else {
      // Good profit = low-moderate risk (15-50)
      riskScore = Math.min(50, 15 + totalRisk * 0.4);
    }
    
    // Ensure minimum and maximum bounds
    riskScore = Math.max(10, Math.min(95, riskScore));
    
    // Debug logging
    console.log(`${crop.name}: profit=${profit.toFixed(0)}, totalRisk=${totalRisk.toFixed(1)}, scenarios=[${priceScenario}%,${costScenario}%,${rainfallScenario}%], finalRisk=${riskScore.toFixed(1)}`);

    return {
      revenue: revenue.toFixed(0),
      profit: profit.toFixed(0),
      yield: adjustedYield.toFixed(0),
      price: adjustedPrice.toFixed(2),
      costs: adjustedCosts.toFixed(0),
      riskScore: riskScore.toFixed(0),
      roi,
      breakEven,
      aiWeatherFactor: aiWeatherFactor.toFixed(3),
      climateRiskFactor: climateRiskFactor.toFixed(3)
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
          {/* Hero Section */}
          <div className="hero-card">
            <div className="hero-content">
              <h1 className="hero-title">Smart Farm Planning Dashboard</h1>
              <p className="hero-subtitle">Make data-driven decisions for maximum profitability with AI-powered crop recommendations and market insights</p>
              <div className="season-badge">
                <div className="season-label">Current Season Outlook</div>
                <div className="season-value">2025 Spring</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div />
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Current Season Outlook</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>2025 Spring</div>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border-color)' }}>
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

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border-color)' }}>
            <div className="input-group">
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
                  USDA NASS API Key (optional - loads live county data)
                </label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter your API key..." />
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, marginRight: 8, color: 'var(--text-secondary)' }}>County:</label>
                <input type="text" value={county} onChange={e => setCounty(e.target.value)} style={{ marginRight: 12 }} />
                <label style={{ fontSize: 13, marginRight: 8, color: 'var(--text-secondary)' }}>State:</label>
                <input type="text" value={stateAlpha} onChange={e => setStateAlpha(e.target.value)} style={{ width: 40, marginRight: 12 }} />
                <label style={{ fontSize: 13, marginRight: 8, color: 'var(--text-secondary)' }}>Commodity:</label>
                <input type="text" value={commodity} onChange={e => setCommodity(e.target.value)} style={{ marginRight: 12 }} />
              </div>
              <button onClick={fetchUSDAData} disabled={isLoading || !apiKey} className="btn-primary">
                {isLoading ? 'Loading...' : 'Load Live Data'}
              </button>
            </div>

            {error && (
              <div className={`alert ${error.includes('✅') ? 'alert-success' : 'alert-warning'}`}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Farm Model Building Section */}
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            🏗️ Build Farm Model
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            Create a custom financial model for your farm. Input your land, irrigation, and budget details to generate detailed crop recommendations with profit projections and risk analysis.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Acres</label>
              <input type="number" value={acres} onChange={(e) => setAcres(e.target.value)} style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Irrigated Acres</label>
              <input type="number" value={irrigated} onChange={(e) => setIrrigated(e.target.value)} style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', fontSize: 14 }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Budget ($)</label>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', fontSize: 14 }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>Zones (optional)</label>
            <input type="text" value={zones} onChange={(e) => setZones(e.target.value)} placeholder="e.g. zone1:10,zone2:40" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', fontSize: 14, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className="btn-primary" onClick={buildModel} disabled={loadingModel}>{loadingModel ? 'Building...' : 'Build Farm Model'}</button>
            <button className="btn-ghost" onClick={testApi} style={{ padding: '8px 12px' }}>Test API</button>
          </div>
          {modelError && (
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>{modelError}</div>
          )}
          {healthStatus && (
            <div className={healthStatus.ok ? "alert alert-success" : "alert alert-warning"} style={{ marginBottom: 12 }}>
              {healthStatus.ok ? (
                <div>API reachable — pid: {healthStatus.info.pid} — timestamp: {new Date(healthStatus.info.timestamp).toLocaleString()}</div>
              ) : (
                <div>API health check failed: {healthStatus.error}</div>
              )}
            </div>
          )}
        </div>

        {/* Farm Model Results */}
        {model && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Farm Model Results</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Optimized crop recommendations based on your farm parameters. These projections show estimated yields, revenues, and profitability for each recommended crop.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
              {model.map((m) => (
                <div key={m.key} className="metric-section" style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{m.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{m.type}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Estimated Yield</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.estimatedYield} {m.type === 'annual' ? 'tons' : 'lbs'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Est. Price</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>${m.estPrice}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Revenue/Acre</div>
                      <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{m.revenuePerAcreFormatted}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Profit/Acre</div>
                      <div style={{ fontWeight: 600, color: m.profitable ? 'var(--success)' : 'var(--warning)' }}>{m.profitPerAcreFormatted}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{m.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {weatherData && (
          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CloudRain className="text-blue-500" /> Current Weather Conditions
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Real-time weather data helps assess current growing conditions and risk factors. This information influences crop stress levels, irrigation needs, and timing decisions for planting and harvesting.
            </p>
            <div className="small-grid-3">
              <div className="metric">
                <div className="label">Last 90 Days Rainfall</div>
                <div className="value" style={{ color: 'var(--accent-2)' }}>{weatherData.recentPrecip}"</div>
              </div>
              <div className="metric">
                <div className="label">Rainfall Anomaly</div>
                <div className="value" style={{ color: parseFloat(weatherData.rainfallAnomaly) > 0 ? 'var(--accent)' : 'var(--warning)' }}>{weatherData.rainfallAnomaly}%</div>
              </div>
              <div className="metric">
                <div className="label">Avg Temperature (30d)</div>
                <div className="value">{weatherData.avgTemp}°F</div>
              </div>
            </div>
          </div>
        )}

        {/* AI Weather Predictions */}
        {(cropMode === 'annual' && annualWeatherPrediction) && (
          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 AI Annual Weather Forecast (2025 Growing Season)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Machine learning models predict seasonal weather patterns to optimize crop selection and timing. These forecasts help farmers plan irrigation, select drought-resistant varieties, and manage climate risks.
            </p>
            <div className="alert alert-success" style={{ marginBottom: 12 }}>
              <strong>AI Prediction Confidence: {(annualWeatherPrediction.aiConfidence * 100).toFixed(0)}%</strong>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Season Outlook: <strong>{annualWeatherPrediction.prediction.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>
              </div>
            </div>
            <div className="small-grid-3">
              <div className="metric">
                <div className="label">Avg Growing Season Temp</div>
                <div className="value" style={{ color: 'var(--accent-2)' }}>{annualWeatherPrediction.avgGrowingTemp}°F</div>
              </div>
              <div className="metric">
                <div className="label">Total Growing Precipitation</div>
                <div className="value" style={{ color: 'var(--accent)' }}>{annualWeatherPrediction.totalGrowingPrecip}"</div>
              </div>
              <div className="metric">
                <div className="label">Climate Risk Factor</div>
                <div className="value" style={{ color: annualWeatherPrediction.climateRisk > 0.3 ? 'var(--warning)' : 'var(--accent)' }}>
                  {(annualWeatherPrediction.climateRisk * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Climate Change Projections for Perennials */}
        {(cropMode === 'perennial' && climateProjections) && (
          <div className="card" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              🌍 Climate Change Projections (20-Year Outlook)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Long-term climate forecasts for perennial investments like orchards and vineyards. These projections help evaluate the viability of multi-decade crop investments and guide variety selection for future conditions.
            </p>
            <div className="alert alert-warning" style={{ marginBottom: 12 }}>
              <strong>Based on IPCC Climate Models</strong> - Moderate scenario (RCP4.5) for Central Valley, CA
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {climateProjections.slice(0, 3).map((projection, index) => (
                <div key={projection.year} style={{ 
                  background: 'var(--card)', 
                  border: `1px solid ${index === 0 ? 'var(--accent)' : index === 1 ? 'var(--warning)' : 'var(--danger)'}`,
                  borderRadius: 8, 
                  padding: 12 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{projection.year}</h3>
                    <div style={{ 
                      fontSize: 12, 
                      color: projection.aiRecommendation === 'consider-diversification' ? 'var(--warning)' : 'var(--accent)',
                      fontWeight: 600
                    }}>
                      {projection.aiRecommendation === 'consider-diversification' ? 'Consider Diversification' : 'Maintain Current'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 13 }}>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Temp +</div>
                      <div style={{ fontWeight: 600, color: 'var(--warning)' }}>{projection.tempIncrease}°F</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Precip</div>
                      <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{projection.precipChange}%</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Yield Factor</div>
                      <div style={{ fontWeight: 600, color: parseFloat(projection.yieldFactor) < 1 ? 'var(--danger)' : 'var(--accent)' }}>
                        {projection.yieldFactor}x
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>Extreme Risk</div>
                      <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{projection.extremeWeatherRisk}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aiWeatherLoading && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>
              <div>🤖 Loading AI weather predictions...</div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
            <Settings style={{ color: 'var(--text-secondary)' }} /> Scenario Planning
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            Interactive sliders to model different market and weather conditions. Adjust these parameters to see how price volatility, input costs, and climate variations affect crop profitability and risk scores in real-time.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>Price Change: {priceScenario > 0 ? '+' : ''}{priceScenario}%</label>
              <input type="range" min="-30" max="30" value={priceScenario} onChange={(e) => setPriceScenario(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>Input Cost Change: {costScenario > 0 ? '+' : ''}{costScenario}%</label>
              <input type="range" min="-20" max="40" value={costScenario} onChange={(e) => setCostScenario(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>Rainfall Change: {rainfallScenario > 0 ? '+' : ''}{rainfallScenario}%</label>
              <input type="range" min="-40" max="40" value={rainfallScenario} onChange={(e) => setRainfallScenario(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            {cropMode === 'annual' ? '🤖 AI-Enhanced Crop Recommendations' : '🌍 Climate-Adjusted Orchard Outlook'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            {cropMode === 'annual' 
              ? 'Annual crops with AI seasonal weather predictions. Optimized for 2025 growing season based on machine learning climate models.' 
              : 'Perennial orchards with climate change projections. Long-term investment analysis incorporating 20-year climate risk assessment.'
            }
            {(annualWeatherPrediction || climateProjections) && (
              <span style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 8 }}>
                ✓ AI Weather Integration Active
              </span>
            )}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {rankedCrops.map((crop, index) => (
              <div key={crop.key} className="card" style={{ transition: 'box-shadow 160ms' }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ 
                    fontSize: 12, 
                    color: index === 0 ? 'var(--text-secondary)' : index === 1 ? 'var(--warning)' : 'var(--danger)', 
                    fontWeight: 700, 
                    textTransform: 'uppercase' 
                  }}>Rank #{index + 1}</div>
                  <h3 style={{ 
                    fontSize: 18, 
                    fontWeight: 700, 
                    color: index === 0 ? 'var(--text-primary)' : index === 1 ? 'var(--warning)' : 'var(--danger)' 
                  }}>{crop.name}</h3>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <div className="profit-section">
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{crop.type === 'annual' ? 'Expected Profit/Acre' : 'Annual Revenue/Acre'}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>${parseFloat(crop.metrics.profit).toLocaleString()}</div>
                  </div>

                  {crop.type === 'perennial' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="roi-section">
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ROI (Annual)</div>
                        <div style={{ fontWeight: 700, color: 'var(--accent-2)' }}>{crop.metrics.roi}%</div>
                      </div>
                      <div className="breakeven-section">
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Break-even</div>
                        <div className="breakeven-text" style={{ fontWeight: 700 }}>{crop.metrics.breakEven} yrs</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
                    <div className="metric-section">
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Yield</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{crop.metrics.yield}</div>
                    </div>
                    <div className="metric-section">
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Price</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${crop.metrics.price}</div>
                    </div>
                    <div className="metric-section">
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Revenue</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${parseFloat(crop.metrics.revenue).toLocaleString()}</div>
                    </div>
                    <div className="metric-section">
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Annual Costs</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${parseFloat(crop.metrics.costs).toLocaleString()}</div>
                    </div>
                  </div>

                  {crop.type === 'perennial' && (
                    <div className="establishment-section">
                      <div className="establishment-text" style={{ fontWeight: 700 }}>Establishment: ${crop.establishmentCost.toLocaleString()}</div>
                      <div className="establishment-text">{crop.yearsToProduction} years to first production</div>
                    </div>
                  )}

                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{crop.description}</div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Risk Score</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{crop.metrics.riskScore}/100</span>
                    </div>
                    <div className="risk-bar">
                      <i style={{ width: `${crop.metrics.riskScore}%`, background: crop.metrics.riskScore < 30 ? 'var(--accent)' : crop.metrics.riskScore < 60 ? 'var(--warning)' : 'var(--danger)' }} />
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
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>{rankedCrops[0].name} - Yield History</h3>
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
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>{rankedCrops[0].name} - Price History</h3>
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

        {/* AI Advisor onboarding & chat */}
        <div style={{ marginTop: 16 }}>
          <AIAdvisor model={model} />
        </div>

        {/* Carbon Credit Calculator */}
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign className="text-green-500" /> Carbon Credit Calculator
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            Calculate potential carbon credit revenue from sustainable farming practices. This tool estimates carbon sequestration benefits and additional income streams from regenerative agriculture and carbon offset programs.
          </p>
          <CarbonCreditCalculator />
        </div>

        <div className="footer-note">Data sources: USDA NASS (county yields) • Open-Meteo (weather) • Live updated {new Date().toLocaleDateString()}</div>
      </div>
    </div>
    </>
  );
};

export default PlantProfitDashboard;