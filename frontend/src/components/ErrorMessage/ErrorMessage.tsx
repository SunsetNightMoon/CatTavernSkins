export function ErrorMessage({ message }: { message: string }) {
  return (
    <div style={{
      padding: '20px',
      textAlign: 'center',
      color: '#ff4d4f',
    }}>
      <h3>错误</h3>
      <p>{message}</p>
    </div>
  );
}
