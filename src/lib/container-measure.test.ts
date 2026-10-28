import { describe, it, expect } from 'vitest'
import { containerMeasure } from '@/lib/container-measure'

describe('containerMeasure', () => {
  it('multiplies the count by the container size and names the container in Polish', () => {
    expect(containerMeasure('2 (14.5 oz) cans diced tomatoes')).toEqual({ amount: '820', unit: 'g', alt: '2 puszki' })
    expect(containerMeasure('1 (8-ounce) package cream cheese, softened')).toEqual({ amount: '230', unit: 'g', alt: '1 opakowanie' })
    expect(containerMeasure('1 (14 ounce) can chickpeas, drained')).toEqual({ amount: '400', unit: 'g', alt: '1 puszka' })
    expect(containerMeasure('5 (15 oz) cans beans')).toEqual({ amount: '2150', unit: 'g', alt: '5 puszek' })
  })

  it('reads the other shapes: size before the container, size after it', () => {
    expect(containerMeasure('2 15-ounce cans black beans')).toEqual({ amount: '850', unit: 'g', alt: '2 puszki' })
    expect(containerMeasure('2 cans (15 oz each) black beans')).toEqual({ amount: '850', unit: 'g', alt: '2 puszki' })
    expect(containerMeasure('1 jar (12 fl oz) roasted peppers')).toEqual({ amount: '355', unit: 'ml', alt: '1 słoik' })
  })

  it('reads fractions, mixed numbers and a metric size', () => {
    expect(containerMeasure('1 1/2 (12 ounces) blocks cream cheese')).toEqual({ amount: '510', unit: 'g', alt: '1 1/2 kostki' })
    expect(containerMeasure('½ (16 oz) package pasta')).toEqual({ amount: '230', unit: 'g', alt: '1/2 opakowania' })
    expect(containerMeasure('2 (400 g) tins chopped tomatoes')).toEqual({ amount: '800', unit: 'g', alt: '2 puszki' })
    expect(containerMeasure('1 (1 l) carton stock')).toEqual({ amount: '1000', unit: 'ml', alt: '1 opakowanie' })
  })

  it('is null for a line that is not a packaged ingredient', () => {
    expect(containerMeasure('2 cups flour')).toBeNull()
    expect(containerMeasure('1 pound ground turkey')).toBeNull()
    expect(containerMeasure('1 can chickpeas')).toBeNull()
    expect(containerMeasure('200 g mąki')).toBeNull()
    expect(containerMeasure('')).toBeNull()
  })
})
