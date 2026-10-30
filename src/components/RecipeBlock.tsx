import type { Recipe } from '@/lib/content'

/** A traditional recipe in our own words, with the page-level note about quantities and allergies. */
export default function RecipeBlock({ recipe, name }: { recipe: Recipe; name: string }) {
  return (
    <section className="mt-12" aria-labelledby="recipe">
      <p className="section-label">Recipe</p>
      <h2 id="recipe" className="section-title mb-3">How to cook {name}</h2>
      {(recipe.servings || recipe.time) && (
        <p className="text-sm text-ink-mid mb-4">{[recipe.servings && `Serves ${recipe.servings}`, recipe.time].filter(Boolean).join(' · ')}</p>
      )}
      <div className="grid md:grid-cols-5 gap-8">
        <div className="md:col-span-2">
          <h3 className="font-serif text-xl text-ink mb-2">Ingredients</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-ink-mid">{recipe.ingredients.map(i => <li key={i}>{i}</li>)}</ul>
        </div>
        <div className="md:col-span-3">
          <h3 className="font-serif text-xl text-ink mb-2">Method</h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-ink-mid leading-relaxed">{recipe.method.map(m => <li key={m}>{m}</li>)}</ol>
          {recipe.tips && recipe.tips.length > 0 && (
            <>
              <h3 className="font-serif text-xl text-ink mt-6 mb-2">Tips</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-ink-mid">{recipe.tips.map(t => <li key={t}>{t}</li>)}</ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
