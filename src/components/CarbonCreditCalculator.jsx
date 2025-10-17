import React, { useState } from 'react';
import './CarbonCreditCalculator.css';

const PRACTICES = [
  {
    label: 'Plant cover crops',
    value: 'cover_crops',
    creditPerAcre: 150,
    description: 'Increase soil carbon and earn credits by planting cover crops.'
  },
  {
    label: 'No-till farming',
    value: 'no_till',
    creditPerAcre: 120,
    description: 'Reduce soil disturbance and sequester more carbon.'
  },
  {
    label: 'Rotational grazing',
    value: 'rotational_grazing',
    creditPerAcre: 100,
    description: 'Improve pasture health and carbon storage.'
  }
];

export default function CarbonCreditCalculator() {
  const [acreage, setAcreage] = useState('');
  const [practice, setPractice] = useState(PRACTICES[0].value);
  const [result, setResult] = useState(null);

  const handleCalculate = (e) => {
    e.preventDefault();
    const selected = PRACTICES.find(p => p.value === practice);
    const acres = parseFloat(acreage);
    if (isNaN(acres) || acres <= 0) {
      setResult({ error: 'Please enter a valid acreage.' });
      return;
    }
    const credits = acres * selected.creditPerAcre;
    setResult({
      credits,
      practice: selected.label,
      description: selected.description,
      acres
    });
  };

  return (
    <div className="carbon-credit-calculator">
      <h2>Carbon Credit Calculator</h2>
      <form onSubmit={handleCalculate} className="ccc-form">
        <label>
          Regenerative Practice:
          <select value={practice} onChange={e => setPractice(e.target.value)}>
            {PRACTICES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label>
          Acreage:
          <input
            type="number"
            min="1"
            step="any"
            value={acreage}
            onChange={e => setAcreage(e.target.value)}
            placeholder="Enter acres"
            required
          />
        </label>
        <button type="submit">Calculate</button>
      </form>
      {result && (
        <div className="ccc-result">
          {result.error ? (
            <span className="ccc-error">{result.error}</span>
          ) : (
            <>
              <h3>Results</h3>
              <p><strong>Practice:</strong> {result.practice}</p>
              <p><strong>Description:</strong> {result.description}</p>
              <p><strong>Acreage:</strong> {result.acres} acres</p>
              <p><strong>Estimated Carbon Credits:</strong> ${result.credits.toLocaleString()} <span className="ccc-dollars">USD</span></p>
              <p className="ccc-esg">Why: ESG narrative = VC catnip</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
