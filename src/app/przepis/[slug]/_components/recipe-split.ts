/**
 * The recipe page's desktop split, ingredients | steps below the header. One string so
 * the checklists and the skeleton keep the same columns and gap.
 */
export const RECIPE_SPLIT = 'lg:grid lg:grid-cols-[1fr_1.6fr] lg:items-start lg:gap-x-12'

/*
 * The frame of the recipe page, one string per block. page.tsx and its loading skeleton
 * (loading.tsx) both read these, so a layout change moves the placeholder with the page:
 * the skeleton used to copy the classes by hand and fell behind when the header went from
 * 1fr | 1.6fr to two equal columns (#637). Only layout lives here: columns, gaps, margins
 * and fixed heights. Colours and content stay with the components.
 */

/** <main>: from lg the list row sits right under the category bar, so the top padding shrinks. */
export const RECIPE_MAIN = 'min-h-screen bg-white py-6 sm:py-8 lg:pt-2'

/** The row above the hero (from lg): list position on the left, breadcrumbs on the right. */
export const RECIPE_TOP_ROW = 'lg:mb-3 lg:flex lg:min-h-[44px] lg:items-center lg:gap-6'

/** The header: two equal columns from lg, the photos | the text column. */
export const RECIPE_HEADER_GRID = 'mb-10 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10'

/** The photos' frame: bleeds to the screen edges below lg, sits in the left column from lg. */
export const RECIPE_COVER_FRAME = 'relative mb-5 -mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:mx-0 lg:mt-0 lg:mb-0'

/** The hairline and the 40 px above the ingredients | steps grid. */
export const RECIPE_CHECKLISTS_TOP = 'border-t border-border-card pt-10'
