import React, { useState } from 'react';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          fontSize: '30px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999
        }}
      >
        🤖
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          width: '350px',
          height: '400px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          padding: '20px',
          zIndex: 9999,
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontWeight: 'bold', margin: 0 }}>🤖 Central do Buffet</h3>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}
            >
              ✕
            </button>
          </div>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Chatbot conectado! Em breve mais funcionalidades.
          </p>
          <div style={{ marginTop: '20px', padding: '10px', background: '#f3f4f6', borderRadius: '8px', fontSize: '12px' }}>
            <strong>Dica:</strong> Você pode usar este chat para tirar dúvidas sobre seus eventos e orçamentos.
          </div>
        </div>
      )}
    </>
  );
};
