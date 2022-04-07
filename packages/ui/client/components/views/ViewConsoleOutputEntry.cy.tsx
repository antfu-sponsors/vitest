import Filter from 'ansi-to-html'
import ViewConsoleOutputEntry from './ViewConsoleOutputEntry.vue'

const htmlSelector = '[data-type=html]'
const textSelector = '[data-type=text]'

describe('ViewConsoleOuyputEntry', () => {
  it('test plain entry', () => {
    const content = new Date().toISOString()
    const container = cy.mount(<ViewConsoleOutputEntry task-name="test/text" type="stderr" time={Date.now()} html={false} content={content}/>)
      .get(textSelector)
    container.should('exist')
    container.invoke('text').then((t) => {
      expect(t).equals(content)
    })
  })
  it('test html entry', () => {
    const now = new Date().toISOString()
    const content = new Filter().toHtml(`\x1B[33m${now}\x1B[0m`)
    const container = cy.mount(<ViewConsoleOutputEntry task-name="test/html" time={Date.now()} html={true} content={content} />)
      .get(htmlSelector)
    container.should('exist')
    container.children('span').then((c) => {
      expect(c).to.have.text(now)
      expect(c).to.have.attr('style', 'color:#A50')
    })
  })
})
