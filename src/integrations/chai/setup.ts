import chai from 'chai'
import SinonChai from 'sinon-chai'
import Subset from 'chai-subset'
import { SnapshotPlugin } from '../snapshot/chai'
import { JestChaiExpect } from './jest-expect'
import { JestExtend } from './jest-extend'

let installed = false
export async function setupChai() {
  if (installed)
    return

  chai.use(SinonChai)
  chai.use(JestExtend())
  chai.use(JestChaiExpect())
  chai.use(Subset)
  chai.use(SnapshotPlugin())
  installed = true
}
