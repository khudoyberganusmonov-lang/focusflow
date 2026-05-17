// Root app — composes sidebar + toolbar + content sections

function App() {
  const [date, setDate] = React.useState('Past 30 Days');

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#e8e8ec',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      color: '#1f1f23',
      overflow: 'hidden',
    }}>
      <div style={{
        width: 'min(1440px, calc(100vw - 32px))',
        height: 'min(920px, calc(100vh - 32px))',
        background: '#fbfbfd',
        borderRadius: 12,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 24px 60px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        display: 'flex',
        position: 'relative',
      }}>
        {/* Window chrome — traffic lights overlay */}
        <div style={{
          position: 'absolute', top: 14, left: 14, zIndex: 30,
          display: 'flex', gap: 8,
        }}>
          {['#ff5f56', '#febc2e', '#27c93f'].map((c, i) => (
            <span key={i} style={{
              width: 12, height: 12, borderRadius: '50%', background: c,
              boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)',
            }} />
          ))}
        </div>

        <Sidebar />

        <main style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
          <Toolbar date={date} onDate={setDate} />
          <div style={{
            flex: 1, overflow: 'auto', padding: 16,
            display: 'flex', flexDirection: 'column', gap: 12,
            background: '#f4f4f6',
          }}>
            <TopStatsRow />
            <ProductivityScore />
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 12,
              alignItems: 'stretch',
            }}>
              <Applications />
              <Projects />
            </div>
            <div style={{ height: 4, flexShrink: 0 }} />
          </div>
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
