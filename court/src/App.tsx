import CourtScene from "./court/CourtScene";

export default function App() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-white px-6 py-12">
      <h1 className="sr-only">A New York park basketball court, seen from above</h1>
      <div className="w-full max-w-[760px]">
        <CourtScene />
      </div>
    </main>
  );
}
