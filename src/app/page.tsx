import CreateRoom from "@/components/CreateRoom";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-accent">
          Bunny
        </h1>
        <p className="mt-3 text-lg text-secondary">
          Watch together, stay together
        </p>
      </div>
      <CreateRoom />
    </main>
  );
}
