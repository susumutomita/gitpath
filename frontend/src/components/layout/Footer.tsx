export function Footer() {
  return (
    <footer className="border-t bg-white py-6">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} GitPath. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
