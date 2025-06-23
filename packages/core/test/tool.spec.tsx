import { expect, test } from 'vitest'
import { render } from '@athena/priompt'

test('should able to create tool from jsx', () => {
  const toolSpec = <tool
    name="write_to_file"
    description="Request to write content to a file at the specified path."
  >
    <arg name="filename"/>
    <arg name="content"/>
    <example>
      <arg name="filename">
        ./example.js
      </arg>
      <arg name="content">
        console.log('Hello, world!');
      </arg>
    </example>
  </tool>

  const result = render(toolSpec)
  expect(result).toEqual(`<tool name="write_to_file" description="Request to write content to a file at the specified path.">
<filename></filename>
<content></content>
</tool>
Example:
<write_to_file>
<filename>./example.js</filename>
<content>console.log('Hello, world!');</content>
</write_to_file>`)
})
