 

export const Header = () => {
  return (
    <div className="w-full sticky top-0 z-50">
      {/* White top bar with logo */}
      <div className="bg-white w-full py-6 px-8 border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <img 
                src="/images/Roth.png" 
                alt="Roth Lab Logo" 
                width={300}
                className="object-contain"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
              <h1 className="text-2xl font-bold text-gray-900">
  CRISPR-All{' '}
  <span className="italic">
    <span className="text-[hsl(66,70%,47%)]">Hands</span>{' '}
    <span className="text-[hsl(13,95%,59%)]">On</span>{' '}
    <span className="text-[hsl(32,75%,49%)]">Deck</span><span className="text-[hsl(220,35%,65%)]">!</span>
  </span>
</h1>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}