import { expect, test } from 'vitest'
import { page, userEvent } from '@vitest/browser/context'
import Blog from '../../src/blog-app/blog'

test('renders blog posts', async () => {
  const screen = page.render(<Blog />)

  await expect.element(screen.getByRole('heading', { name: 'Blog' })).toBeInTheDocument()

  const posts = screen.getByRole('listitem').all()

  expect(posts).toHaveLength(4)

  const [firstPost, secondPost] = posts

  expect(firstPost.element()).toHaveTextContent(/molestiae ut ut quas/)
  expect(firstPost.getByRole('heading').element()).toHaveTextContent(/occaecati excepturi/)

  expect(screen.getByRole('listitem').nth(0).element()).toHaveTextContent(/molestiae ut ut quas/)
  var thrown
  try {
    screen.getByRole('listitem').nth(666)
  } catch(err) {
    thrown = err
  }
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown.message).toMatch(/^Cannot find element/)

  await expect.element(secondPost.getByRole('heading')).toHaveTextContent('qui est esse')

  await userEvent.click(secondPost.getByRole('button', { name: 'Delete' }))

  expect(screen.getByRole('listitem').all()).toHaveLength(3)

  expect(screen.getByPlaceholder('non-existing').query()).not.toBeInTheDocument()
})
